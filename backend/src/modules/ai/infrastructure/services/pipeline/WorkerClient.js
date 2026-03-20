/**
 * Worker Client (Layer 2.5)
 * HTTP client that dispatches tasks to the Python browser-use service.
 */

import { logger } from '../../../../../shared/services/LoggerService.js';

const WORKER_BASE_URL = process.env.BROWSER_WORKER_URL || 'http://localhost:8500';
const WORKER_TIMEOUT_MS = parseInt(
  process.env.BROWSER_WORKER_TIMEOUT_MS || '45000',
  10,
);

const VALID_TASK_TYPES = new Set([
  'hotels', 'restaurants', 'attractions',
  'transport', 'activities', 'nightlife', 'custom',
]);

export class WorkerClient {
  constructor(baseUrl = WORKER_BASE_URL, timeoutMs = WORKER_TIMEOUT_MS) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Execute a single task on the Python worker service.
   *
   * @param {import('./OrchestratorAgent.js').WorkerTask} task
   * @returns {Promise<{taskId: string, status: string, data: any, error?: string}>}
   */
  async executeTask(task) {
    const taskType = VALID_TASK_TYPES.has(task.taskType)
      ? task.taskType
      : 'custom';

    if (taskType !== task.taskType) {
      logger.warn('[WorkerClient] Mapped invalid taskType:', {
        original: task.taskType,
        mapped: taskType,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    const startTime = Date.now();

    try {
      logger.info('[WorkerClient] Dispatching task:', {
        taskId: task.taskId,
        taskType,
        query: task.query.substring(0, 60),
      });

      const response = await fetch(`${this.baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.taskId,
          taskType,
          query: task.query,
          context: task.context || {},
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Worker returned ${response.status}: ${errorBody}`,
        );
      }

      const result = await response.json();

      logger.info('[WorkerClient] Task completed:', {
        taskId: task.taskId,
        status: result.status,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('[WorkerClient] Task timed out:', {
          taskId: task.taskId,
          timeoutMs: this.timeoutMs,
        });
        return {
          taskId: task.taskId,
          status: 'timeout',
          data: null,
          error: `Task timed out after ${this.timeoutMs}ms`,
        };
      }

      logger.error('[WorkerClient] Task failed:', {
        taskId: task.taskId,
        error: error.message,
      });
      return {
        taskId: task.taskId,
        status: 'error',
        data: null,
        error: error.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check worker service health.
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
