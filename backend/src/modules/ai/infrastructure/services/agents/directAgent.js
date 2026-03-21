/**
 * Direct Agent
 * Handles simple queries with a single ReAct loop.
 * Used for non-planning queries (weather, info, recommendations).
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { getSynthesisModel } from '../provider.js';
import { buildLangChainTools } from '../langchainTools.js';
import { buildSystemPrompt } from '../../../domain/prompts/index.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * Run a simple ReAct agent for non-planning queries.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {Object} options
 * @param {string} [options.modelId]
 * @param {Object} [options.context]
 * @param {string} [options.userId]
 * @param {string} [options.conversationId]
 * @param {Object} [options.userProfile]
 * @returns {Promise<{content: string, toolCalls: Array, usage: Object}>}
 */
export async function runDirectAgent(messages, options = {}) {
  const {
    modelId, context = {}, userId, conversationId, userProfile,
  } = options;

  // Use synthesis model (non-thinking) for faster responses
  const model = getSynthesisModel();
  const tools = buildLangChainTools(
    { taskType: 'research' },
    { userId, conversationId, userProfile },
  );

  const systemPrompt = buildSystemPrompt({
    ...context,
    userProfile,
  });

  const agent = createReactAgent({
    llm: model,
    tools,
    stateModifier: systemPrompt,
  });

  try {
    const result = await agent.invoke({ messages });

    const agentMessages = result.messages || [];
    let content = '';
    const toolCalls = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    for (const msg of agentMessages) {
      const msgType = msg.constructor?.name || msg._getType?.() || '';

      if (msgType === 'AIMessage' || msgType === 'AIMessageChunk') {
        if (typeof msg.content === 'string' && msg.content) {
          content = msg.content;
        }
        if (msg.usage_metadata) {
          usage.inputTokens += msg.usage_metadata.input_tokens || 0;
          usage.outputTokens += msg.usage_metadata.output_tokens || 0;
        }
      }

      if (msgType === 'ToolMessage') {
        const parsed = safeParseJSON(msg.content);
        toolCalls.push({ name: msg.name, result: parsed });
      }
    }

    return { content, toolCalls, usage };
  } catch (error) {
    logger.error('[DirectAgent] Failed:', { error: error.message });
    throw error;
  }
}

/**
 * Streaming version of runDirectAgent. Yields token-by-token events.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @returns {AsyncGenerator<{type: string, content?: string, name?: string, result?: any}>}
 */
export async function* streamDirectAgent(messages, options = {}) {
  const {
    context = {}, userId, conversationId, userProfile, signal,
  } = options;

  const model = getSynthesisModel();
  const tools = buildLangChainTools(
    { taskType: 'research' },
    { userId, conversationId, userProfile },
  );

  const systemPrompt = buildSystemPrompt({
    ...context,
    userProfile,
  });

  const agent = createReactAgent({
    llm: model,
    tools,
    stateModifier: systemPrompt,
  });

  try {
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2', signal },
    );

    let usage = { inputTokens: 0, outputTokens: 0 };

    for await (const event of eventStream) {
      if (signal?.aborted) return;

      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        const token = chunk?.content;
        if (typeof token === 'string' && token) {
          yield { type: 'content', content: token };
        }
        if (chunk?.usage_metadata) {
          usage.inputTokens += chunk.usage_metadata.input_tokens || 0;
          usage.outputTokens += chunk.usage_metadata.output_tokens || 0;
        }
      } else if (event.event === 'on_tool_start') {
        yield {
          type: 'tool_call_start',
          name: event.name,
          arguments: event.data?.input || {},
        };
      } else if (event.event === 'on_tool_end') {
        yield {
          type: 'tool_result',
          name: event.name,
          result: safeParseJSON(event.data?.output),
        };
      }
    }

    yield { type: 'usage', usage };
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.info('[DirectAgent] Stream aborted by client');
      return;
    }
    logger.error('[DirectAgent] Stream failed:', { error: error.message });
    throw error;
  }
}

function safeParseJSON(str) {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch { return str; }
}
