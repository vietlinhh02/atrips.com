/**
 * AI Provider Configuration (LangChain)
 * All models route through the OpenAI-compatible proxy (OAI_BASE_URL).
 * Supports per-layer model selection for pipeline optimization.
 */

import { ChatOpenAI } from '@langchain/openai';

const baseURL = (process.env.OAI_BASE_URL || 'http://localhost:8317') + '/v1';
const proxyApiKey = process.env.OAI_API_KEY || 'dummy';

function createModel(modelId, maxTokens = 16384) {
  return new ChatOpenAI({
    model: modelId,
    configuration: { baseURL },
    apiKey: proxyApiKey,
    maxTokens,
  });
}

export function getModel(modelId) {
  const id = modelId
    || process.env.OAI_MODEL
    || process.env.AI_MODEL
    || 'gpt-4-turbo';
  return createModel(id);
}

export function getFastModel() {
  const id = process.env.OAI_FAST_MODEL
    || 'kiro-claude-haiku-4-5';
  return createModel(id, 4096);
}

export function getSynthesisModel() {
  const id = process.env.OAI_SYNTHESIS_MODEL
    || process.env.OAI_FALLBACK_MODEL
    || 'kiro-claude-sonnet-4-5';
  return createModel(id, 16384);
}

export function getFallbackModel() {
  const id = process.env.OAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
  return createModel(id);
}
