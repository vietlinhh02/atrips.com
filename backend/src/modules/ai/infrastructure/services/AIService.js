/**
 * AI Service (Refactored)
 * Routes queries through the 5-layer pipeline architecture:
 *   - Simple queries → DirectAgent (ReAct)
 *   - Trip management → TripManageAgent (ReAct)
 *   - Trip planning → PlanningPipeline (5 layers)
 */

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import cacheService from '../../../../shared/services/CacheService.js';
import { buildSystemPrompt, buildTaskPrompt } from '../../domain/prompts/index.js';
import { TOOL_DEFINITIONS, getToolsForContext } from '../../domain/tools/index.js';
import toolExecutor from './ToolExecutor.js';
import { runDirectAgent } from './agents/directAgent.js';
import { runTripManageAgent } from './agents/tripManageAgent.js';
import { streamDirectAgent } from './agents/directAgent.js';
import { streamTripManageAgent } from './agents/tripManageAgent.js';
import { PlanningPipeline } from './pipeline/PlanningPipeline.js';
import { compressMessages } from './contextCompressor.js';
import { logger } from '../../../../shared/services/LoggerService.js';
import { guardMessage } from './guards/PromptGuard.js';

const CACHE_TTL = { CHAT: 3600, MODELS: 86400, STATUS: 300 };

// Intent classification keywords
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
  /\d{1,2}[/\-]\d{1,2}/,
  /tháng\s*\d+/i,
  /từ\s*.+đến/i,
  /cuối tuần|weekend/i,
  /\d+\s*(người|person|traveler|khách)/i,
];

function classifyIntent(message) {
  const content = message.toLowerCase();

  if (TRIP_MANAGE_KEYWORDS.some(k => content.includes(k))) {
    return 'trip_manage';
  }

  const isComplex = COMPLEX_KEYWORDS.some(k => content.includes(k));
  if (isComplex) return 'complex';

  return 'simple';
}

function formatUsage(usage) {
  const input = usage?.inputTokens || 0;
  const output = usage?.outputTokens || 0;
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: input + output,
  };
}

function toLangChainMessages(messages) {
  return messages.map(m => {
    if (m.role === 'user') return new HumanMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    if (m.role === 'system') return new SystemMessage(m.content);
    return new HumanMessage(m.content);
  });
}

class AIService {
  constructor() {
    this.baseUrl = process.env.OAI_BASE_URL || 'http://localhost:8317';
    this.apiKey = process.env.OAI_API_KEY || '';
    this.model = process.env.OAI_MODEL || process.env.AI_MODEL || 'gpt-4-turbo';
    this.fallbackModel = process.env.OAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
    this.cacheEnabled = process.env.AI_CACHE_ENABLED !== 'false';
    this.toolsEnabled = process.env.AI_TOOLS_ENABLED !== 'false';
  }

  getSystemPrompt(context = {}, taskType = null) {
    return taskType
      ? buildTaskPrompt(taskType, context)
      : buildSystemPrompt(context);
  }

  generateCacheKey(messages, options = {}) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    return cacheService.generateChatKey([{
      message: lastUserMessage?.content || '',
      model: options.model || this.model,
      contextKeys: Object.keys(options.context || {}),
    }], options);
  }

  /**
   * Chat with AI (non-streaming).
   * Routes to appropriate agent based on intent.
   */
  async chat(messages, options = {}) {
    const {
      model = this.model,
      temperature = 0.7,
      context = {},
      skipCache = false,
      enableTools = this.toolsEnabled,
      userId = null,
      conversationId = null,
    } = options;

    const userMessages = messages.filter(m => m.role !== 'system');
    const cacheKey = this.generateCacheKey(messages, { model, context });

    // Cache check for deterministic, tool-free queries
    if (this.cacheEnabled && !skipCache && temperature <= 0.3 && !enableTools) {
      const cached = await cacheService.get(cacheKey);
      if (cached) return { ...cached, fromCache: true };
    }

    try {
      const compressedMessages = compressMessages(userMessages);
      const lcMessages = toLangChainMessages(compressedMessages);
      const lastMessage = userMessages[userMessages.length - 1]?.content || '';
      const intent = classifyIntent(lastMessage);
      const userProfile = context.userProfile || null;

      logger.info('[AIService] Intent:', { intent, message: lastMessage.substring(0, 60) });

      // PromptGuard: check for injection/leak attempts
      // Note: requestIp not passed here — falls back to userId or 'anonymous' for proxy requests.
      const guardResult = await guardMessage(lastMessage, {
        conversationId, userId,
      });
      if (guardResult.action !== 'pass') {
        return {
          content: guardResult.content,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model,
          finishReason: 'stop',
          fromCache: false,
          guarded: true,
        };
      }

      let result;

      switch (intent) {
        case 'trip_manage':
          result = await runTripManageAgent(lcMessages, {
            modelId: model, userId, conversationId, userProfile,
          });
          break;

        case 'complex': {
          const pipeline = new PlanningPipeline({
            modelId: model, userId, conversationId, userProfile,
          });
          const pipelineResult = await pipeline.run(userMessages);

          if (pipelineResult.type === 'clarification') {
            result = {
              content: pipelineResult.question,
              toolCalls: [],
              usage: { inputTokens: 0, outputTokens: 0 },
              clarification: {
                missing: pipelineResult.missing,
                gathered: pipelineResult.gathered,
              },
            };
          } else if (pipelineResult.type === 'not_travel') {
            // Not a travel query, fall through to direct agent
            result = await runDirectAgent(lcMessages, {
              modelId: model, context, userId,
              conversationId, userProfile,
            });
          } else {
            result = pipelineResult;
          }
          break;
        }

        default:
          result = await runDirectAgent(lcMessages, {
            modelId: model, context, userId,
            conversationId, userProfile,
          });
      }

      const totalUsage = formatUsage(result.usage);
      const toolCalls = result.toolCalls || [];

      const finalResult = {
        content: result.content || '',
        usage: totalUsage,
        model,
        finishReason: 'stop',
        fromCache: false,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        draftId: result.draftId || undefined,
        clarification: result.clarification || undefined,
      };

      if (this.cacheEnabled && !skipCache && temperature <= 0.3 && toolCalls.length === 0) {
        await cacheService.set(cacheKey, finalResult, CACHE_TTL.CHAT);
      }

      return finalResult;
    } catch (error) {
      if (model !== this.fallbackModel) {
        logger.warn(`Primary model failed (${error.message}), trying fallback`);
        return this.chat(messages, { ...options, model: this.fallbackModel });
      }
      throw error;
    }
  }

  /**
   * Chat with AI (streaming).
   * Yields SSE events via async generator pipe-through.
   *
   * @param {Array} messages
   * @param {Object} options
   * @param {AbortSignal} [options.signal]
   */
  async *chatStream(messages, options = {}) {
    const {
      model = this.model,
      context = {},
      enableTools = this.toolsEnabled,
      userId = null,
      conversationId = null,
      signal,
    } = options;

    const userMessages = messages.filter(m => m.role !== 'system');
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    const intent = classifyIntent(lastMessage);
    const userProfile = context.userProfile || null;

    logger.info('[AIService Stream] Intent:', { intent });

    // PromptGuard
    const guardResult = await guardMessage(lastMessage, {
      conversationId, userId,
    });
    if (guardResult.action !== 'pass') {
      yield { type: 'content', content: guardResult.content };
      yield { type: 'finish', reason: 'guarded' };
      return;
    }

    const compressedMessages = compressMessages(userMessages);
    const lcMessages = toLangChainMessages(compressedMessages);

    try {
      if (intent === 'complex') {
        const pipeline = new PlanningPipeline({
          modelId: model, userId, conversationId, userProfile,
        });

        const clarification = await pipeline.clarify(userMessages);

        if (clarification.notTravelQuery) {
          yield* streamDirectAgent(lcMessages, {
            context, userId, conversationId, userProfile, signal,
          });
          yield { type: 'finish', reason: 'stop' };
          return;
        }

        if (!clarification.complete) {
          yield {
            type: 'clarification',
            question: clarification.question,
            missing: clarification.missing,
            gathered: clarification.gathered,
          };
          yield { type: 'content', content: clarification.question };
          yield { type: 'finish', reason: 'clarification' };
          return;
        }

        // Stream the full planning pipeline
        yield* pipeline.planStream(clarification.context, { signal });
        yield { type: 'finish', reason: 'stop' };

      } else if (intent === 'trip_manage') {
        yield* streamTripManageAgent(lcMessages, {
          modelId: model, userId, conversationId, userProfile, signal,
        });
        yield { type: 'finish', reason: 'stop' };

      } else {
        yield* streamDirectAgent(lcMessages, {
          context, userId, conversationId, userProfile, signal,
        });
        yield { type: 'finish', reason: 'stop' };
      }
    } catch (error) {
      const isAbort = error.name === 'AbortError'
        || error.message === 'Abort'
        || error.message === 'AbortError';
      if (isAbort) {
        logger.info('[AIService Stream] Aborted by client');
        return;
      }
      logger.error('[AIService Stream] Error:', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  // ─── Delegate methods ───

  async getRecommendations(params) {
    const { location, type, budget, interests = [] } = params;
    return this.chat(
      [{ role: 'user', content: `Recommend the best ${type || 'places'} in ${location}.\n${budget ? `Budget: ${budget}` : ''}\n${interests.length > 0 ? `Interests: ${interests.join(', ')}` : ''}\n\nUse the search_places tool to find real venues with verified data.` }],
      { context: { destination: location, budget, interests }, taskType: 'recommend', temperature: 0.6, enableTools: true },
    );
  }

  async estimateBudget(params) {
    const { destination, duration, travelers = 1, style = 'comfort' } = params;
    return this.chat(
      [{ role: 'user', content: `Estimate the total cost for a trip to ${destination} for ${duration}.\nTravelers: ${travelers}\nStyle: ${style}\n\nUse tools to look up flight prices, hotel rates, and exchange rates.\nBreak down by category.` }],
      { context: { destination, duration, travelers, travelStyle: style }, taskType: 'budget', temperature: 0.4, enableTools: true },
    );
  }

  async executeTool(toolName, args) {
    return toolExecutor.execute(toolName, args);
  }

  getAvailableTools(context = {}) {
    return getToolsForContext(context);
  }

  getAllToolDefinitions() {
    return TOOL_DEFINITIONS;
  }

  async getModels() {
    const cacheKey = 'ai:models:list';
    if (this.cacheEnabled) {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const response = await fetch(`${this.baseUrl}/v1/models`, { method: 'GET', headers });
      if (!response.ok) return this.getDefaultModels();

      const data = await response.json();
      if (this.cacheEnabled) await cacheService.set(cacheKey, data, CACHE_TTL.MODELS);
      return data;
    } catch (error) {
      logger.warn('Failed to fetch models:', { error: error.message });
      return this.getDefaultModels();
    }
  }

  getDefaultModels() {
    const now = Math.floor(Date.now() / 1000);
    return {
      object: 'list',
      data: [
        { id: this.model, object: 'model', created: now, owned_by: 'atrips' },
        { id: this.fallbackModel, object: 'model', created: now, owned_by: 'atrips' },
      ],
    };
  }

  async getStatus() {
    const cacheKey = 'ai:provider:status';
    if (this.cacheEnabled) {
      const cached = await cacheService.get(cacheKey);
      if (cached) return { ...cached, fromCache: true };
    }

    try {
      const models = await this.getModels();
      const cacheStats = await cacheService.getStats();
      const availableTools = this.getAvailableTools();

      const status = {
        provider: 'langchain',
        status: 'operational',
        baseUrl: this.baseUrl,
        primaryModel: this.model,
        fallbackModel: this.fallbackModel,
        availableModels: models.data || [],
        tools: {
          enabled: this.toolsEnabled,
          available: availableTools.map(t => t.function?.name || t.type),
        },
        cache: { enabled: this.cacheEnabled, ...cacheStats },
      };

      if (this.cacheEnabled) await cacheService.set(cacheKey, status, CACHE_TTL.STATUS);
      return status;
    } catch (error) {
      return {
        provider: 'langchain',
        status: 'error',
        error: error.message,
        tools: { enabled: this.toolsEnabled },
        cache: { enabled: this.cacheEnabled },
      };
    }
  }

  async clearCache() {
    await cacheService.delPattern('ai:*');
    logger.info('[Cache] AI cache cleared');
  }
}

export default new AIService();
