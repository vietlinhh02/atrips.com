/**
 * AI Provider Configuration (LangChain)
 * All models route through the OpenAI-compatible proxy (OAI_BASE_URL).
 * Supports per-layer model selection for pipeline optimization.
 */

import { ChatOpenAI } from '@langchain/openai';

const baseURL = (process.env.OAI_BASE_URL || 'https://r8cwid3.9router.com') + '/v1';
const proxyApiKey = process.env.OAI_API_KEY || 'dummy';

function createModel(modelId, maxTokens = 16384, temperature) {
  const opts = {
    model: modelId,
    configuration: { baseURL },
    apiKey: proxyApiKey,
    maxTokens,
  };
  if (temperature !== undefined) opts.temperature = temperature;
  return new ChatOpenAI(opts);
}

export function getModel(modelId) {
  const id = modelId
    || process.env.OAI_MODEL
    || process.env.AI_MODEL
    || 'ag/gemini-3-flash';
  return createModel(id);
}

export function getFastModel() {
  const id = process.env.OAI_FAST_MODEL
    || 'ag/gemini-3-flash';
  return createModel(id, 4096, 0.3);
}

export function getSynthesisModel() {
  const id = process.env.OAI_SYNTHESIS_MODEL
    || process.env.OAI_FALLBACK_MODEL
    || 'ag/gemini-3.1-pro-low';
  return createModel(id, 16384, 0.7);
}

export function getFallbackModel() {
  const id = process.env.OAI_FALLBACK_MODEL || 'ag/claude-sonnet-4-6';
  return createModel(id);
}
