/**
 * Tool Worker (Layer 2.5 — API-based)
 * Replaces browser-use WorkerClient with direct API tool calls.
 * Each task type maps to 1-2 existing tool handlers (search_places,
 * web_search, search_hotels, etc.) — no Chrome needed.
 */

import toolExecutor from '../ToolExecutor.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * Task type → tool call configuration.
 * Each entry defines which tools to call and how to build args.
 */
const TASK_TOOL_MAP = {
  attractions: {
    tools: [
      { name: 'search_places', buildArgs: (q, ctx) => ({
        query: `${ctx.destination} tourist attractions`,
        location: ctx.destination,
        type: 'attraction',
        limit: 10,
      })},
      { name: 'web_search', buildArgs: (q) => ({
        query: q,
        limit: 5,
      })},
    ],
  },
  restaurants: {
    tools: [
      { name: 'search_places', buildArgs: (q, ctx) => ({
        query: `restaurants local food ${ctx.destination}`,
        location: ctx.destination,
        type: 'restaurant',
        limit: 10,
      })},
      { name: 'web_search', buildArgs: (q) => ({
        query: q,
        limit: 3,
      })},
    ],
  },
  hotels: {
    tools: [
      { name: 'search_hotels', buildArgs: (q, ctx) => ({
        destination: ctx.destination,
        checkin: ctx.startDate || '',
        checkout: ctx.endDate || '',
        guests: ctx.groupSize || 2,
        budget: ctx.budget || 'mid-range',
      })},
    ],
  },
  transport: {
    tools: [
      { name: 'web_search', buildArgs: (q) => ({
        query: q,
        limit: 5,
      })},
    ],
  },
  activities: {
    tools: [
      { name: 'search_places', buildArgs: (q, ctx) => ({
        query: `${ctx.destination} activities tours experiences`,
        location: ctx.destination,
        type: 'activity',
        limit: 8,
      })},
      { name: 'web_search', buildArgs: (q) => ({
        query: q,
        limit: 3,
      })},
    ],
  },
  nightlife: {
    tools: [
      { name: 'search_places', buildArgs: (q, ctx) => ({
        query: `${ctx.destination} nightlife bars night market`,
        location: ctx.destination,
        limit: 8,
      })},
    ],
  },
};

const DEFAULT_TOOLS = {
  tools: [
    { name: 'web_search', buildArgs: (q) => ({
      query: q,
      limit: 5,
    })},
  ],
};

export class ToolWorker {
  /**
   * Execute a single task using API tools instead of browser.
   *
   * @param {import('./OrchestratorAgent.js').WorkerTask} task
   * @returns {Promise<{taskId: string, status: string, data: any, error?: string}>}
   */
  async executeTask(task) {
    const startTime = Date.now();
    const config = TASK_TOOL_MAP[task.taskType] || DEFAULT_TOOLS;

    try {
      logger.info('[ToolWorker] Executing task:', {
        taskId: task.taskId,
        taskType: task.taskType,
        toolCount: config.tools.length,
      });

      // Run all tools for this task type in parallel
      const results = await Promise.allSettled(
        config.tools.map(async (toolDef) => {
          const args = toolDef.buildArgs(task.query, task.context || {});
          return toolExecutor.execute(toolDef.name, args);
        }),
      );

      // Merge all successful results
      const mergedData = [];
      for (const outcome of results) {
        if (outcome.status === 'fulfilled' && outcome.value?.success) {
          mergedData.push(outcome.value.data || outcome.value);
        }
      }

      const data = mergedData.length > 0 ? mergedData : null;

      logger.info('[ToolWorker] Task completed:', {
        taskId: task.taskId,
        status: data ? 'success' : 'empty',
        durationMs: Date.now() - startTime,
        resultCount: mergedData.length,
      });

      return {
        taskId: task.taskId,
        status: data ? 'success' : 'error',
        data,
        error: data ? undefined : 'No data from API tools',
      };
    } catch (error) {
      logger.error('[ToolWorker] Task failed:', {
        taskId: task.taskId,
        error: error.message,
        durationMs: Date.now() - startTime,
      });
      return {
        taskId: task.taskId,
        status: 'error',
        data: null,
        error: error.message,
      };
    }
  }

  async healthCheck() {
    return true;
  }
}
