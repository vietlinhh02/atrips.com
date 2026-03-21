import { Queue, Worker } from 'bullmq';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

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

class ExploreEnrichmentJob {
  constructor() {
    this.queue = null;
    this.worker = null;
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn(
        '[ExploreEnrichment] No REDIS_URL, skipping job init',
      );
      return;
    }

    const connection = parseRedisUrl(redisUrl);

    this.queue = new Queue('explore-enrichment', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    this.worker = new Worker(
      'explore-enrichment',
      (job) => this.processJob(job),
      {
        connection,
        concurrency: 2,
        limiter: { max: 5, duration: 1000 },
      },
    );

    this.worker.on('completed', (job) => {
      logger.debug(
        `[ExploreEnrichment] Job ${job.id} completed`,
      );
    });

    this.worker.on('failed', (job, err) => {
      logger.warn(
        `[ExploreEnrichment] Job ${job.id} failed: ${err.message}`,
      );
    });

    this.scheduleDaily();
    logger.info('[ExploreEnrichment] Job worker initialized');
  }

  async processJob(job) {
    const { type } = job.data;

    switch (type) {
      case 'update-popularity':
        await this.updatePopularityScores();
        break;
      default:
        logger.warn(
          `[ExploreEnrichment] Unknown job type: ${type}`,
        );
    }
  }

  async updatePopularityScores() {
    const destinations = await prisma.destinations.findMany({
      where: { isActive: true },
      select: { id: true, cachedPlaceId: true },
    });

    for (const dest of destinations) {
      const [saveCount, tripCount] = await Promise.all([
        prisma.saved_places.count({
          where: { placeId: dest.cachedPlaceId },
        }),
        prisma.activities.count({
          where: { placeId: dest.cachedPlaceId },
        }),
      ]);

      const score = saveCount * 2 + tripCount * 5;

      await prisma.destinations.update({
        where: { id: dest.id },
        data: { popularityScore: score },
      });
    }

    logger.info(
      `[ExploreEnrichment] Updated popularity for ${destinations.length} destinations`,
    );
  }

  async scheduleDaily() {
    await this.queue.add(
      'daily-enrichment',
      { type: 'update-popularity' },
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: 'daily-popularity-update',
      },
    );
  }

  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export default new ExploreEnrichmentJob();
