/**
 * AI Provider Configuration (LangChain)
 * All models route through the OpenAI-compatible proxy (OAI_BASE_URL).
 */

import { ChatOpenAI } from '@langchain/openai';

const baseURL = (process.env.OAI_BASE_URL || 'http://localhost:8317') + '/v1';
const proxyApiKey = process.env.OAI_API_KEY || 'dummy';

function createModel(modelId) {
  return new ChatOpenAI({
    model: modelId,
    configuration: { baseURL },
    apiKey: proxyApiKey,
    maxTokens: 16384,
  });
}

export function getModel(modelId) {
  const id = modelId
    || process.env.OAI_MODEL
    || process.env.AI_MODEL
    || 'gpt-4-turbo';
  return createModel(id);
}

export function getFallbackModel() {
  const id = process.env.OAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
  return createModel(id);
}
