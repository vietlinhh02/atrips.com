/**
 * Trip Management Agent
 * Handles CRUD operations on trips via ReAct agent.
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getModel } from '../provider.js';
import { buildLangChainTools } from '../langchainTools.js';
import { TRIP_MANAGE_SYSTEM_PROMPT } from '../../../domain/prompts/tripManagePrompt.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * Run the trip management agent.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {Object} options
 * @returns {Promise<{content: string, toolCalls: Array, usage: Object}>}
 */
export async function runTripManageAgent(messages, options = {}) {
  const {
    modelId, userId, conversationId, userProfile,
  } = options;

  const model = getModel(modelId);
  const tools = buildLangChainTools(
    { taskType: 'trip_manage' },
    { userId, conversationId, userProfile },
  );

  const agent = createReactAgent({
    llm: model,
    tools,
    stateModifier: TRIP_MANAGE_SYSTEM_PROMPT,
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
    logger.error('[TripManageAgent] Failed:', { error: error.message });
    throw error;
  }
}

function safeParseJSON(str) {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch { return str; }
}
