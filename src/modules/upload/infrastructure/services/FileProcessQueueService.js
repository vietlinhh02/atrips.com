/**
 * File Process Queue Service
 * BullMQ queue for file processing jobs (image variants + document extraction)
 */

import { Queue, Worker } from 'bullmq';
import { logger } from '../../../../shared/services/LoggerService.js';
import { processFileJob } from './FileProcessWorker.js';

const QUEUE_NAME = 'file-process';

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
      db: url.pathname
        ? parseInt(url.pathname.slice(1), 10) || 0
        : 0,
    };
  } catch {
    return null;
  }
}

class FileProcessQueueService {
  constructor() {
    this.queue = null;
    this.worker = null;
    this.isReady = false;
    this.connection = null;
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    this.connection = parseRedisUrl(redisUrl);

    if (!this.connection) {
      logger.warn(
        '[FileProcess] REDIS_URL not configured — file process queue disabled'
      );
      return false;
    }

    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });

    this.worker = new Worker(QUEUE_NAME, processFileJob, {
      connection: this.connection,
      concurrency: 3,
      limiter: { max: 10, duration: 1000 },
    });

    this.worker.on('completed', (job) => {
      logger.debug(
        `[FileProcess] Job ${job.id} completed: ${job.data.fileName}`
      );
    });

    this.worker.on('failed', (job, err) => {
      logger.warn(
        `[FileProcess] Job ${job?.id} failed: ${err.message}`
      );
    });

    this.worker.on('error', (err) => {
      logger.error(`[FileProcess] Worker error: ${err.message}`);
    });

    this.isReady = true;
    logger.info('[FileProcess] Queue and worker initialized');
    return true;
  }

  async addJob(data) {
    if (!this.isReady || !this.queue) return null;
    return this.queue.add('process', data, {
      jobId: `file-${data.fileUploadId}`,
    });
  }

  async getStats() {
    if (!this.queue) return null;
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
      logger.info('[FileProcess] Worker closed');
    }
    if (this.queue) {
      await this.queue.close();
      logger.info('[FileProcess] Queue closed');
    }
  }
}

export default new FileProcessQueueService();
