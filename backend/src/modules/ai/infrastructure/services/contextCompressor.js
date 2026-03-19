/**
 * Context Compressor
 * Trims conversation history to fit within model token budget.
 * Keeps system message + most recent messages, adding older messages
 * from newest to oldest until the budget is exhausted.
 */

const MODEL_TOKEN_LIMIT = parseInt(process.env.AI_MODEL_TOKEN_LIMIT, 10) || 128000;

/**
 * Estimate token count from text.
 * Uses 1 token ≈ 3 characters for better accuracy with Vietnamese text.
 */
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  return Math.ceil(text.length / 3);
}

/**
 * Estimate tokens for a single message.
 */
function messageTokens(msg) {
  let tokens = 4; // message overhead
  tokens += estimateTokens(msg.content);
  if (msg.tool_calls) {
    tokens += estimateTokens(JSON.stringify(msg.tool_calls));
  }
  return tokens;
}

/**
 * Compress messages to fit within token budget.
 *
 * Strategy:
 * 1. Always keep the last `tailCount` messages (most recent context)
 * 2. Add older messages from newest to oldest until budget is exceeded
 * 3. Keep tool call/result pairs together (don't split them)
 *
 * @param {Array} messages - Conversation messages (without system - system is passed separately to AI SDK)
 * @param {Object} options
 * @param {number} options.modelLimit - Model context window size (default 128000)
 * @param {number} options.maxOutputTokens - Reserved for output (default 16384)
 * @param {number} options.tailCount - Minimum recent messages to keep (default 4)
 * @returns {Array} Compressed messages
 */
export function compressMessages(messages, options = {}) {
  const {
    modelLimit = MODEL_TOKEN_LIMIT,
    maxOutputTokens = 16384,
    tailCount = 4,
  } = options;

  if (!messages || messages.length === 0) return [];

  // Budget = model limit - output reserve - safety margin
  const budget = modelLimit - maxOutputTokens - 1024;

  // If messages fit within budget, return as-is
  const totalTokens = messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
  if (totalTokens <= budget) {
    return messages;
  }

  // Split into tail (must keep) and older messages
  const safeTail = Math.min(tailCount, messages.length);
  const tail = messages.slice(-safeTail);
  const older = messages.slice(0, -safeTail);

  // Count tokens used by tail
  let usedTokens = tail.reduce((sum, msg) => sum + messageTokens(msg), 0);

  // Add older messages from newest to oldest
  const kept = [];
  for (let i = older.length - 1; i >= 0; i--) {
    const msg = older[i];
    const tokens = messageTokens(msg);

    // Keep tool call/result pairs together
    if (msg.role === 'tool' && i > 0 && older[i - 1].role === 'assistant') {
      const pairTokens = tokens + messageTokens(older[i - 1]);
      if (usedTokens + pairTokens <= budget) {
        kept.unshift(msg);
        kept.unshift(older[i - 1]);
        usedTokens += pairTokens;
        i--; // skip the assistant message we just added
        continue;
      }
      break; // can't fit the pair, stop
    }

    if (usedTokens + tokens <= budget) {
      kept.unshift(msg);
      usedTokens += tokens;
    } else {
      break;
    }
  }

  return [...kept, ...tail];
}
