/**
 * Orchestrator Graph
 * LangGraph StateGraph that classifies intent, routes to direct agent
 * or parallel subagents, then synthesizes the final response.
 */

import { StateGraph, Send, END, START } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { OrchestratorState } from './state.js';
import {
  createSearchAgent,
  createPlaceAgent,
  createBudgetAgent,
  createBookingAgent,
  createTripManageAgent,
  createSynthesizerAgent,
} from './subagents.js';
import { getModel, getFallbackModel } from '../provider.js';
import { buildLangChainTools } from '../langchainTools.js';
import { buildSystemPrompt } from '../../../domain/prompts/index.js';
import toolExecutor from '../ToolExecutor.js';

// Intent keywords for classification
const COMPLEX_KEYWORDS = [
  'plan', 'itinerary', 'lịch trình', 'chuyến đi', 'trip',
  'kế hoạch', 'schedule', 'travel plan', 'du lịch',
];

const TRIP_MANAGE_KEYWORDS = [
  'tạo chuyến', 'create trip', 'save trip', 'apply draft',
  'áp dụng', 'lưu', 'xóa', 'delete trip', 'update trip',
  'sửa', 'thêm hoạt động', 'add activity', 'xây dựng',
  'get my trips', 'danh sách chuyến',
];

const DETAIL_INDICATORS = [
  /\d+\s*(ngày|đêm|day|night)/i,
  /\d{1,2}[\/\-]\d{1,2}/,
  /tháng\s*\d+/i,
  /từ\s*.+đến/i,
  /cuối tuần|weekend/i,
  /\d+\s*(người|person|traveler|khách)/i,
];

/**
 * Classify intent from the last user message.
 */
function classifyIntent(messages) {
  const lastUserMsg = [...messages]
    .reverse()
    .find(m =>
      m instanceof HumanMessage ||
      m.constructor?.name === 'HumanMessage' ||
      m._getType?.() === 'human' ||
      m.role === 'user'
    );
  if (!lastUserMsg) return 'simple';

  const content = (typeof lastUserMsg.content === 'string'
    ? lastUserMsg.content
    : lastUserMsg.content?.[0]?.text || ''
  ).toLowerCase();

  if (TRIP_MANAGE_KEYWORDS.some(k => content.includes(k))) {
    return 'trip_manage';
  }

  const isComplex = COMPLEX_KEYWORDS.some(k => content.includes(k));
  if (!isComplex) return 'simple';

  const hasDetail = DETAIL_INDICATORS.some(r => r.test(content));
  if (hasDetail) return 'complex';

  console.log(
    '[Orchestrator] Complex intent but missing details' +
    ' — routing to directAgent for clarification'
  );
  return 'simple';
}

/**
 * Extract tool call info from LangChain messages.
 */
function extractToolCallsFromMessages(messages) {
  const toolCalls = [];
  for (const msg of messages) {
    const type = msg.constructor?.name || msg._getType?.();
    if (type === 'ToolMessage') {
      toolCalls.push({
        name: msg.name,
        result: safeParseJSON(msg.content),
      });
    }
  }
  return toolCalls;
}

function safeParseJSON(str) {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch { return str; }
}

/**
 * Sum usage metadata from messages.
 */
function sumUsageFromMessages(messages) {
  let input = 0;
  let output = 0;
  for (const msg of messages) {
    if (msg.usage_metadata) {
      input += msg.usage_metadata.input_tokens || 0;
      output += msg.usage_metadata.output_tokens || 0;
    }
  }
  return { inputTokens: input, outputTokens: output };
}

function getLastAIContent(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const type = msg.constructor?.name || msg._getType?.();
    if (type === 'AIMessage' || msg instanceof AIMessage) {
      return typeof msg.content === 'string' ? msg.content : '';
    }
  }
  return '';
}

/**
 * Build the orchestrator graph.
 */
export function buildOrchestratorGraph(options = {}) {
  const {
    modelId,
    context = {},
    taskType = null,
    enableTools = true,
    userId = null,
    conversationId = null,
    userProfile = null,
  } = options;

  // createReactAgent needs a model with bindTools — withFallbacks() wraps
  // the model in RunnableWithFallbacks which strips bindTools. So we pass
  // the primary model directly. Fallback is handled at AIService level.
  const model = getModel(modelId);

  const langchainTools = enableTools
    ? buildLangChainTools(
        { taskType },
        { userId, conversationId, userProfile },
      )
    : [];

  const systemPrompt = buildSystemPrompt({ ...context, userProfile });

  // ── classify node ──
  async function classify(state) {
    const intent = classifyIntent(state.messages);
    console.log(`[Orchestrator] Intent: ${intent}`);
    return { intent, systemPrompt };
  }

  // ── route after classification ──
  function routeAfterClassify(state) {
    const dest = state.intent || 'simple';
    console.log(`[Orchestrator] Routing to: ${dest}`);
    return dest;
  }

  // ── direct agent (single ReAct loop for simple queries) ──
  const directReactAgent = createReactAgent({
    llm: model,
    tools: langchainTools,
    stateModifier: systemPrompt,
  });

  async function directAgentNode(state) {
    try {
      const result = await directReactAgent.invoke({
        messages: state.messages,
      });
      const newMessages = result.messages.slice(state.messages.length);
      return {
        finalResponse: getLastAIContent(newMessages),
        toolCalls: extractToolCallsFromMessages(newMessages),
        usage: sumUsageFromMessages(newMessages),
        messages: newMessages,
      };
    } catch (error) {
      console.error('[DirectAgent] Error:', error.message);
      return {
        finalResponse: `Xin lỗi, đã có lỗi xảy ra: ${error.message}`,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  // ── plan subtasks node (for complex queries) ──
  async function planSubtasks(state) {
    const lastMsg = [...state.messages]
      .reverse()
      .find(m =>
        m instanceof HumanMessage ||
        m.constructor?.name === 'HumanMessage' ||
        m._getType?.() === 'human' ||
        m.role === 'user'
      );
    const userQuery = typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : lastMsg?.content?.[0]?.text || '';

    const plan = [];
    const queryLower = userQuery.toLowerCase();

    plan.push({ agent: 'search', task: userQuery });
    plan.push({ agent: 'place', task: userQuery });

    if (/budget|cost|price|giá|chi phí|ngân sách|flight|hotel|khách sạn|máy bay/.test(queryLower)) {
      plan.push({ agent: 'budget', task: userQuery });
    }

    plan.push({ agent: 'synthesizer', task: userQuery });

    console.log(`[Orchestrator] Plan: ${plan.map(p => p.agent).join(', ')}`);
    return { plan };
  }

  // ── dispatch: fan-out to parallel workers via Send ──
  function dispatchWorkers(state) {
    const workers = state.plan.filter(p => p.agent !== 'synthesizer');
    if (workers.length === 0) {
      // No workers to dispatch, go straight to synthesizer
      return 'synthesizer';
    }
    return workers.map(p => new Send(`${p.agent}Worker`, {
      messages: state.messages,
      plan: [p],
      systemPrompt: state.systemPrompt,
      userId: state.userId,
      conversationId: state.conversationId,
      userProfile: state.userProfile,
      subResults: {},
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      intent: state.intent,
      finalResponse: '',
    }));
  }

  // ── worker helper ──
  // Note: subagents already have stateModifier (system prompt) from createReactAgent.
  // Do NOT pass SystemMessage here — Gemini rejects system messages after the first position.
  const WORKER_TIMEOUT_MS = 60000;

  async function runSubagent(agentFactory, state) {
    const agent = agentFactory(model, langchainTools);
    const task = state.plan?.[0]?.task || '';
    const agentName = state.plan?.[0]?.agent || 'unknown';

    try {
      const result = await Promise.race([
        agent.invoke({ messages: [new HumanMessage(task)] }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Worker ${agentName} timed out after ${WORKER_TIMEOUT_MS / 1000}s`)),
            WORKER_TIMEOUT_MS,
          )
        ),
      ]);

      return {
        subResults: { [agentName]: getLastAIContent(result.messages) },
        toolCalls: extractToolCallsFromMessages(result.messages),
        usage: sumUsageFromMessages(result.messages),
      };
    } catch (error) {
      console.error(`[${agentName}Worker] Error:`, error.message);
      return {
        subResults: { [agentName]: `[AGENT_ERROR] ${error.message}` },
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  async function searchWorker(state) {
    return runSubagent(createSearchAgent, state);
  }

  async function placeWorker(state) {
    return runSubagent(createPlaceAgent, state);
  }

  async function budgetWorker(state) {
    return runSubagent(createBudgetAgent, state);
  }

  async function bookingWorker(state) {
    return runSubagent(createBookingAgent, state);
  }

  async function tripManageWorkerNode(state) {
    try {
      const agent = createTripManageAgent(model, langchainTools);
      const result = await agent.invoke({
        messages: state.messages,
      });
      const newMessages = result.messages.slice(state.messages.length);
      return {
        finalResponse: getLastAIContent(newMessages),
        toolCalls: extractToolCallsFromMessages(newMessages),
        usage: sumUsageFromMessages(newMessages),
        messages: newMessages,
      };
    } catch (error) {
      console.error('[TripManageWorker] Error:', error.message);
      return {
        finalResponse: `Xin lỗi, đã có lỗi xảy ra: ${error.message}`,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  // ── synthesizer ──
  // Three-phase approach:
  //   A: synthAgent calls optimize_itinerary (LLM + tool)
  //   B: Code calls create_trip_plan programmatically (no LLM)
  //   C: model.invoke() writes user-facing itinerary text (LLM, no tools)
  async function synthesizerNode(state) {
    const subResultsSummary = Object.entries(state.subResults || {})
      .map(([agent, result]) => {
        if (typeof result === 'string' && result.startsWith('[AGENT_ERROR]')) {
          return `## ${agent}: Failed — ${result.slice(14)}`;
        }
        return `## ${agent} results:\n${result}`;
      })
      .join('\n\n');

    const lastUserMsg = [...state.messages]
      .reverse()
      .find(m =>
        m instanceof HumanMessage ||
        m.constructor?.name === 'HumanMessage' ||
        m._getType?.() === 'human' ||
        m.role === 'user'
      );
    const userQuery = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg?.content?.[0]?.text || '';

    const allToolCalls = [];
    let totalUsage = { inputTokens: 0, outputTokens: 0 };

    try {
      // ─── Phase A: optimize_itinerary via synthAgent ───
      console.log('[Synthesizer] Phase A: calling optimize_itinerary...');
      const synthAgent = createSynthesizerAgent(model, langchainTools);
      const optimizeResult = await Promise.race([
        synthAgent.invoke({
          messages: [
            new HumanMessage(
              `Call optimize_itinerary for: ${userQuery}\n` +
              `Destination: infer from request. Dates: infer or use upcoming weekend.\n` +
              `After the tool returns, reply with ONLY "done".`,
            ),
          ],
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('optimize phase timed out')), 90000),
        ),
      ]);

      const phaseAToolCalls = extractToolCallsFromMessages(optimizeResult.messages);
      allToolCalls.push(...phaseAToolCalls);
      const phaseAUsage = sumUsageFromMessages(optimizeResult.messages);
      totalUsage.inputTokens += phaseAUsage.inputTokens;
      totalUsage.outputTokens += phaseAUsage.outputTokens;

      // Extract optimize_itinerary result
      const optimizeTc = phaseAToolCalls.find(tc => tc.name === 'optimize_itinerary');
      const rawData = optimizeTc?.result;
      const parsed = typeof rawData === 'string' ? safeParseJSON(rawData) : rawData;
      const days = parsed?.days || parsed?.data?.days || [];

      console.log(`[Synthesizer] Phase A done: ${days.length} days, ${phaseAToolCalls.length} tool calls`);

      // ─── Phase B: create_trip_plan programmatically ───
      if (days.length > 0) {
        console.log('[Synthesizer] Phase B: calling create_trip_plan...');

        // Build itineraryData from optimize results
        const itineraryData = {
          days: days.map(day => ({
            dayNumber: day.dayNumber,
            date: day.date,
            theme: `Day ${day.dayNumber}`,
            activities: (day.places || []).map((place, idx) => {
              const startHour = 8 + Math.floor(idx * 1.5);
              const hour = String(Math.min(startHour, 21)).padStart(2, '0');
              return {
                time: `${hour}:00`,
                title: place.name,
                description: `Visit ${place.name}`,
                location: place.address || place.name,
                duration: place.estimatedDuration || 90,
                type: place.type || 'ATTRACTION',
                googleMapsInfo: {
                  rating: place.rating,
                  ratingCount: place.ratingCount,
                },
              };
            }),
          })),
        };

        // Infer destination and dates from user query + optimize data
        const destination = parsed?.destination
          || days[0]?.places?.[0]?.address?.match(/Đà Lạt|Da Lat|Hà Nội|Hanoi|Sài Gòn|Saigon/i)?.[0]
          || userQuery.match(/(?:đà lạt|da lat|hà nội|hanoi|sài gòn|saigon|nha trang|phú quốc|huế|đà nẵng)/i)?.[0]
          || 'Vietnam';
        const startDate = days[0]?.date || null;
        const endDate = days[days.length - 1]?.date || null;

        try {
          const draftResult = await toolExecutor.execute('create_trip_plan', {
            title: `Du lịch ${destination} ${days.length} ngày`,
            destination,
            startDate,
            endDate,
            travelersCount: 1,
            itineraryData,
          });
          allToolCalls.push({ name: 'create_trip_plan', result: draftResult });
          console.log('[Synthesizer] Phase B done:', draftResult.success ? 'draft created' : draftResult.error);
        } catch (draftErr) {
          console.error('[Synthesizer] Phase B error:', draftErr.message);
          allToolCalls.push({ name: 'create_trip_plan', result: { success: false, error: draftErr.message } });
        }
      }

      // ─── Phase C: LLM writes user-facing text ───
      console.log('[Synthesizer] Phase C: generating user-facing itinerary...');
      const itinerarySummary = days.map(day => {
        const places = (day.places || [])
          .map(p => `  - ${p.name} (${p.type}, ★${p.rating || '?'})${p.address ? ` — ${p.address}` : ''}`)
          .join('\n');
        return `Day ${day.dayNumber} (${day.date || ''}):\n${places}`;
      }).join('\n\n');

      const enrichResult = await Promise.race([
        model.invoke([
          new HumanMessage(
            `Viết lịch trình du lịch chi tiết dựa trên dữ liệu sau.\n\n` +
            `YÊU CẦU: ${userQuery}\n\n` +
            `LỊCH TRÌNH TỐI ƯU:\n${itinerarySummary}\n\n` +
            `THÔNG TIN TỪ WEB:\n${subResultsSummary.substring(0, 4000)}\n\n` +
            `HƯỚNG DẪN FORMAT:\n` +
            `- Mỗi ngày chia thành Sáng / Trưa / Chiều / Tối\n` +
            `- Ghi giờ cụ thể (08:00, 10:30, 12:00...)\n` +
            `- Tên địa điểm, địa chỉ, đánh giá sao\n` +
            `- Gợi ý ăn uống cụ thể (tên quán, món ăn)\n` +
            `- Mẹo di chuyển giữa các điểm\n` +
            `- Trả lời bằng tiếng Việt`,
          ),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('enrich phase timed out')), 60000),
        ),
      ]);

      const finalResponse = typeof enrichResult.content === 'string' ? enrichResult.content : '';
      totalUsage.inputTokens += enrichResult.usage_metadata?.input_tokens || 0;
      totalUsage.outputTokens += enrichResult.usage_metadata?.output_tokens || 0;

      console.log(`[Synthesizer] Phase C done: ${finalResponse.length} chars`);

      return {
        finalResponse,
        toolCalls: allToolCalls,
        usage: totalUsage,
      };
    } catch (error) {
      console.error('[Synthesizer] Error:', error.message);
      return {
        finalResponse: subResultsSummary || `Xin lỗi, đã có lỗi xảy ra: ${error.message}`,
        toolCalls: allToolCalls,
        usage: totalUsage,
      };
    }
  }

  // ── Build the graph ──
  const graph = new StateGraph(OrchestratorState)
    .addNode('classify', classify)
    .addNode('directAgent', directAgentNode)
    .addNode('planSubtasks', planSubtasks)
    .addNode('searchWorker', searchWorker)
    .addNode('placeWorker', placeWorker)
    .addNode('budgetWorker', budgetWorker)
    .addNode('bookingWorker', bookingWorker)
    .addNode('tripManageWorker', tripManageWorkerNode)
    .addNode('synthesizer', synthesizerNode)
    // Entry
    .addEdge(START, 'classify')
    // classify → route by intent
    .addConditionalEdges('classify', routeAfterClassify, {
      simple: 'directAgent',
      complex: 'planSubtasks',
      trip_manage: 'tripManageWorker',
    })
    // planSubtasks → fan out to workers via Send
    .addConditionalEdges('planSubtasks', dispatchWorkers, [
      'searchWorker', 'placeWorker', 'budgetWorker', 'bookingWorker', 'synthesizer',
    ])
    // All workers → synthesizer
    .addEdge('searchWorker', 'synthesizer')
    .addEdge('placeWorker', 'synthesizer')
    .addEdge('budgetWorker', 'synthesizer')
    .addEdge('bookingWorker', 'synthesizer')
    // Terminal nodes
    .addEdge('directAgent', END)
    .addEdge('tripManageWorker', END)
    .addEdge('synthesizer', END)
    .compile();

  return graph;
}
