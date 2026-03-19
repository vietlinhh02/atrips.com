/**
 * Image Queue Service
 * BullMQ queue for image ingestion jobs
 */

import { Queue, Worker } from 'bullmq';
import { logger } from '../../../../shared/services/LoggerService.js';

const QUEUE_NAME = 'image-ingest';

/**
 * Parse REDIS_URL into ioredis-compatible connection object
 */
function parseRedisUrl(redisUrl) {
  if (!redisUrl) return null;
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || '127.0.0.1',
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
    };
  } catch {
    return null;
  }
}

class ImageQueueService {
  constructor() {
    this.queue = null;
    this.worker = null;
    this.isReady = false;
    this.connection = null;
  }

  /**
   * Initialize queue and worker
   * @param {Function} processJob - async function(job) to process each job
   * @returns {boolean}
   */
  init(processJob) {
    const redisUrl = process.env.REDIS_URL;
    this.connection = parseRedisUrl(redisUrl);

    if (!this.connection) {
      logger.warn('[ImageQueue] REDIS_URL not configured — image queue disabled');
      return false;
    }

    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });

    this.worker = new Worker(QUEUE_NAME, processJob, {
      connection: this.connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    });

    this.worker.on('completed', (job) => {
      logger.debug(`[ImageQueue] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.warn(`[ImageQueue] Job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      logger.error(`[ImageQueue] Worker error: ${err.message}`);
    });

    this.isReady = true;
    logger.info('[ImageQueue] Queue and worker initialized');
    return true;
  }

  /**
   * Add a single job to the queue
   */
  async addJob(data) {
    if (!this.isReady || !this.queue) return null;
    return this.queue.add('ingest', data);
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulk(jobs) {
    if (!this.isReady || !this.queue || !jobs.length) return [];
    const bulkJobs = jobs.map(data => ({
      name: 'ingest',
      data,
    }));
    return this.queue.addBulk(bulkJobs);
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    if (!this.queue) return null;
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Graceful shutdown
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      logger.info('[ImageQueue] Worker closed');
    }
    if (this.queue) {
      await this.queue.close();
      logger.info('[ImageQueue] Queue closed');
    }
  }
}

export default new ImageQueueService();
