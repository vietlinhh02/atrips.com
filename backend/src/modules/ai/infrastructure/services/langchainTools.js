/**
 * LangChain Tool Builder
 * Bridges existing JSON Schema tool definitions to LangChain DynamicStructuredTool format.
 * Reuses the same guardrail pipeline as toolAdapter.js: sanitize → rate limit → cache → execute → simplify.
 */

import { tool } from '@langchain/core/tools';
import { getToolsForContext } from '../../domain/tools/index.js';
import { jsonSchemaToZod } from './toolAdapter.js';
import toolExecutor from './ToolExecutor.js';
import {
  sanitizeToolInput,
  ToolCache,
  SlidingWindowLimiter,
  MODEL_OUTPUT_SIMPLIFIERS,
  TOOL_CACHE_CONFIG,
  TOOL_RATE_LIMITS,
} from './toolGuards.js';

const toolCache = new ToolCache();
const rateLimiter = new SlidingWindowLimiter();

/**
 * Build a single LangChain tool with all guardrails.
 */
function buildGuardedLangChainTool(name, description, parameters, executionContext) {
  const zodSchema = jsonSchemaToZod(parameters);
  const { userId, conversationId, userProfile } = executionContext;

  const cacheConfig = TOOL_CACHE_CONFIG[name];
  const rateConfig = TOOL_RATE_LIMITS[name];
  const simplifier = MODEL_OUTPUT_SIMPLIFIERS[name];

  return tool(
    async (args) => {
      // Guard 1: Input sanitization
      const sanitizedArgs = sanitizeToolInput(args);

      // Guard 2: Rate limiting
      if (rateConfig) {
        const identifier = userId || 'anonymous';
        const allowed = rateLimiter.check(
          name, identifier, rateConfig.limit, rateConfig.windowMs,
        );
        if (!allowed) {
          console.warn(`[RateLimit] ${name} exceeded for ${identifier}`);
          return JSON.stringify({
            success: false,
            error: `Rate limit exceeded for ${name}. Please wait.`,
            code: rateConfig.errorCode,
          });
        }
      }

      // Guard 3: Cache read
      if (cacheConfig) {
        const shouldBypass = cacheConfig.shouldBypass?.(sanitizedArgs);
        if (!shouldBypass) {
          const cacheKey = cacheConfig.key(sanitizedArgs);
          if (cacheKey) {
            const cached = toolCache.get(name, cacheKey);
            if (cached) {
              console.log(`[ToolCache] HIT ${name}:${cacheKey.substring(0, 20)}`);
              const result = { ...cached, _fromToolCache: true };
              return JSON.stringify(simplifier ? simplifier(result) : result);
            }
          }
        }
      }

      // Guard 4: Execute
      const result = await toolExecutor.executeWithContext(name, sanitizedArgs, {
        userId,
        conversationId,
        userProfile,
      });

      // Guard 5: Cache write
      if (cacheConfig && result?.success) {
        const cacheKey = cacheConfig.key(sanitizedArgs);
        if (cacheKey) {
          const ttl = typeof cacheConfig.ttlSeconds === 'function'
            ? cacheConfig.ttlSeconds(sanitizedArgs, result)
            : cacheConfig.ttlSeconds;
          if (ttl) toolCache.set(name, cacheKey, result, ttl);
        }
      }

      // Guard 6: Simplify for model
      const output = simplifier && result?.success !== false
        ? simplifier(result)
        : result;

      return JSON.stringify(output);
    },
    {
      name,
      description,
      schema: zodSchema,
    },
  );
}

/**
 * Build LangChain tools from existing tool definitions with full guardrails.
 *
 * @param {Object} filterContext - { taskType, enabledTools }
 * @param {Object} executionContext - { userId, conversationId, userProfile }
 * @returns {import('@langchain/core/tools').StructuredTool[]}
 */
export function buildLangChainTools(filterContext = {}, executionContext = {}) {
  const definitions = getToolsForContext(filterContext);
  const tools = [];

  for (const def of definitions) {
    if (def.type !== 'function' || !def.function) continue;
    const { name, description, parameters } = def.function;
    tools.push(buildGuardedLangChainTool(name, description, parameters, executionContext));
  }

  return tools;
}
