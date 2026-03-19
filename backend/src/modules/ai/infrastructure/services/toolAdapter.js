/**
 * Tool Adapter with Guardrails
 * Bridges existing JSON Schema tool definitions to AI SDK tool format.
 * Integrates: input sanitization, per-tool caching, rate limiting,
 * toModelOutput simplification, and execution context injection.
 *
 * Adapted from reference implementation's createAiTool() factory pattern.
 */

import { z } from 'zod';
import { getToolsForContext } from '../../domain/tools/index.js';
import toolExecutor from './ToolExecutor.js';
import { sanitizeToolInput, ToolCache, SlidingWindowLimiter, MODEL_OUTPUT_SIMPLIFIERS, TOOL_CACHE_CONFIG, TOOL_RATE_LIMITS } from './toolGuards.js';
import { TOOL_ERROR_CODES } from './toolErrors.js';

// Shared instances (singleton per process)
const toolCache = new ToolCache();
const rateLimiter = new SlidingWindowLimiter();

// ─────────────────────────────────────────────────
// JSON Schema → Zod conversion
// ─────────────────────────────────────────────────

function jsonSchemaPropertyToZod(prop) {
  // z.record(z.any()) breaks Zod v4 toJSONSchema — use z.object({}).passthrough()
  if (!prop || !prop.type) return z.string().optional();

  let schema;
  switch (prop.type) {
    case 'string':
      schema = prop.enum ? z.enum(prop.enum) : z.string();
      break;
    case 'number':
    case 'integer':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = prop.items
        ? z.array(jsonSchemaPropertyToZod(prop.items))
        : z.array(z.string());
      break;
    case 'object':
      schema = prop.properties
        ? jsonSchemaToZod(prop)
        : z.object({}).passthrough();
      break;
    default:
      schema = z.string();
  }

  if (prop.description) schema = schema.describe(prop.description);
  return schema;
}

export function jsonSchemaToZod(schema) {
  if (!schema || schema.type !== 'object') return z.object({});

  const properties = schema.properties || {};
  const required = schema.required || [];
  const shape = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodProp = jsonSchemaPropertyToZod(prop);
    if (!required.includes(key)) zodProp = zodProp.optional();
    shape[key] = zodProp;
  }

  return z.object(shape);
}

// ─────────────────────────────────────────────────
// Tool Builder with Guardrails
// ─────────────────────────────────────────────────

/**
 * Build a single AI SDK tool with all guardrails applied.
 *
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @param {object} parameters - JSON Schema parameters
 * @param {object} executionContext - { userId, conversationId, userProfile }
 * @returns {object} AI SDK tool definition
 */
function buildGuardedTool(name, description, parameters, executionContext) {
  const zodSchema = jsonSchemaToZod(parameters);
  const { userId, conversationId, userProfile } = executionContext;

  const cacheConfig = TOOL_CACHE_CONFIG[name];
  const rateConfig = TOOL_RATE_LIMITS[name];
  const simplifier = MODEL_OUTPUT_SIMPLIFIERS[name];

  const toolDef = {
    description,
    parameters: zodSchema,

    execute: async (args) => {
      // ── Guard 1: Input sanitization ──
      const sanitizedArgs = sanitizeToolInput(args);

      // ── Guard 2: Rate limiting ──
      if (rateConfig) {
        const identifier = userId || 'anonymous';
        const allowed = rateLimiter.check(name, identifier, rateConfig.limit, rateConfig.windowMs);
        if (!allowed) {
          console.warn(`[RateLimit] ${name} exceeded for ${identifier}`);
          return {
            success: false,
            error: `Rate limit exceeded for ${name}. Please wait before trying again.`,
            code: rateConfig.errorCode,
          };
        }
      }

      // ── Guard 3: Cache read ──
      if (cacheConfig) {
        const shouldBypass = cacheConfig.shouldBypass?.(sanitizedArgs);
        if (!shouldBypass) {
          const cacheKey = cacheConfig.key(sanitizedArgs);
          if (cacheKey) {
            const cached = toolCache.get(name, cacheKey);
            if (cached) {
              console.log(`[ToolCache] HIT ${name}:${cacheKey.substring(0, 20)}`);
              return { ...cached, _fromToolCache: true };
            }
          }
        }
      }

      // ── Guard 4: Execute with context injection ──
      const result = await toolExecutor.executeWithContext(name, sanitizedArgs, {
        userId,
        conversationId,
        userProfile,
      });

      // ── Guard 5: Cache write ──
      if (cacheConfig && result?.success) {
        const cacheKey = cacheConfig.key(sanitizedArgs);
        if (cacheKey) {
          const ttl = typeof cacheConfig.ttlSeconds === 'function'
            ? cacheConfig.ttlSeconds(sanitizedArgs, result)
            : cacheConfig.ttlSeconds;
          if (ttl) {
            toolCache.set(name, cacheKey, result, ttl);
          }
        }
      }

      return result;
    },
  };

  // AI SDK v6: experimental_toToolResultContent was removed.
  // Apply simplification inside execute() instead if a simplifier is configured.
  if (simplifier) {
    const originalExecute = toolDef.execute;
    toolDef.execute = async (args) => {
      const result = await originalExecute(args);
      try {
        if (result && result.success !== false) {
          return simplifier(result);
        }
      } catch {
        // Fallback to full output if simplifier fails
      }
      return result;
    };
  }

  return toolDef;
}

// ─────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────

/**
 * Build AI SDK tools from existing tool definitions with full guardrails.
 *
 * @param {Object} filterContext - Context for filtering tools (taskType, enabledTools)
 * @param {Object} [executionContext={}] - Runtime context injected into tools
 * @param {string} [executionContext.userId] - Current user ID
 * @param {string} [executionContext.conversationId] - Current conversation ID
 * @param {Object} [executionContext.userProfile] - User profile for personalization
 * @returns {Object} Map of tool name -> AI SDK tool with guardrails
 */
export function buildAISDKTools(filterContext = {}, executionContext = {}) {
  const definitions = getToolsForContext(filterContext);
  const tools = {};

  for (const def of definitions) {
    // Skip non-function tools (e.g. google_search grounding)
    if (def.type !== 'function' || !def.function) continue;

    const { name, description, parameters } = def.function;
    tools[name] = buildGuardedTool(name, description, parameters, executionContext);
  }

  return tools;
}

/**
 * Get cache stats for monitoring.
 */
export function getToolCacheStats() {
  return { size: toolCache.size };
}
