/**
 * Funnel (Layer 3 — Collection)
 * Collects results from parallel browser workers.
 * All tasks run concurrently; results are gathered via Promise.allSettled.
 */

import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * @typedef {Object} FunnelResult
 * @property {Array<{taskId: string, taskType: string, status: string, data: any, error?: string}>} results
 * @property {{total: number, succeeded: number, failed: number, timedOut: number}} summary
 */

export class Funnel {
  /**
   * @param {import('./WorkerClient.js').WorkerClient} workerClient
   */
  constructor(workerClient) {
    this.workerClient = workerClient;
  }

  /**
   * Dispatch all tasks in parallel and collect results.
   *
   * @param {import('./OrchestratorAgent.js').WorkerTask[]} tasks
   * @param {(event: Object) => void} [onProgress] - Optional progress callback
   * @returns {Promise<FunnelResult>}
   */
  async collect(tasks, onProgress) {
    logger.info('[Funnel] Dispatching tasks:', {
      count: tasks.length,
      types: tasks.map(t => t.taskType),
    });

    // Notify start of each task
    if (onProgress) {
      for (const task of tasks) {
        onProgress({
          type: 'worker_started',
          taskId: task.taskId,
          taskType: task.taskType,
        });
      }
    }

    const settled = await Promise.allSettled(
      tasks.map(async (task) => {
        const result = await this.workerClient.executeTask(task);

        // Notify completion
        if (onProgress) {
          if (result.status === 'success') {
            onProgress({
              type: 'worker_completed',
              taskId: task.taskId,
              taskType: task.taskType,
              preview: summarizeResult(result.data),
            });
          } else {
            onProgress({
              type: 'worker_failed',
              taskId: task.taskId,
              taskType: task.taskType,
              error: result.error,
            });
          }
        }

        return { ...result, taskType: task.taskType };
      }),
    );

    const results = settled.map((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        return outcome.value;
      }
      return {
        taskId: tasks[i].taskId,
        taskType: tasks[i].taskType,
        status: 'error',
        data: null,
        error: outcome.reason?.message || 'Unknown error',
      };
    });

    const summary = {
      total: results.length,
      succeeded: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      timedOut: results.filter(r => r.status === 'timeout').length,
    };

    logger.info('[Funnel] Collection complete:', summary);

    return { results, summary };
  }
}

/**
 * Create a short preview string from worker result data.
 */
function summarizeResult(data) {
  if (!data) return 'No data';
  if (typeof data === 'string') return data.substring(0, 100);
  if (Array.isArray(data)) return `${data.length} items found`;
  return JSON.stringify(data).substring(0, 100);
}
