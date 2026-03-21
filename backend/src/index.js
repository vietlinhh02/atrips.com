/**
 * ATrips Backend Application
 * Main entry point
 */

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import passport from 'passport';

import config from './config/index.js';
import { connectDatabase, prisma } from './config/database.js';
import { configureGoogleStrategy } from './config/passport.js';
import cacheService from './shared/services/CacheService.js';
import { logger } from './shared/services/LoggerService.js';
import r2StorageService from './modules/image/infrastructure/services/R2StorageService.js';
import imageQueueService from './modules/image/infrastructure/services/ImageQueueService.js';
import { processImageIngestJob } from './modules/image/infrastructure/services/ImageIngestWorker.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { requestMetrics } from './shared/middleware/requestMetrics.js';
import googleAuthUseCase from './modules/auth/application/useCases/GoogleAuthUseCase.js';

// Import routes
import authRoutes from './modules/auth/interfaces/http/authRoutes.js';
import userRoutes from './modules/auth/interfaces/http/userRoutes.js';
import profileRoutes from './modules/profile/interfaces/http/profileRoutes.js';
import chatRoutes from './modules/chat/interfaces/http/chatRoutes.js';
import aiRoutes from './modules/ai/interfaces/http/aiRoutes.js';
import openaiProxyRoutes from './modules/ai/interfaces/http/openaiProxyRoutes.js';
import tripRoutes from './modules/trip/interfaces/http/tripRoutes.js';
import cacheRoutes from './shared/interfaces/http/cacheRoutes.js';
import configRoutes from './shared/interfaces/http/configRoutes.js';
import imageRoutes from './modules/image/interfaces/http/imageRoutes.js';
import notificationRoutes from './modules/notification/interfaces/http/notificationRoutes.js';
import collectionRoutes from './modules/collection/interfaces/http/collectionRoutes.js';
import activityVoteRoutes from './modules/trip/interfaces/http/activityVoteRoutes.js';
import storyRoutes from './modules/story/interfaces/http/storyRoutes.js';
import expenseRoutes from './modules/expense/interfaces/http/expenseRoutes.js';
import weatherRoutes from './modules/weather/interfaces/http/weatherRoutes.js';
import gamificationRoutes from './modules/gamification/interfaces/http/gamificationRoutes.js';
import flightRoutes from './modules/flight/interfaces/http/flightRoutes.js';
import eventRoutes from './modules/event/interfaces/http/eventRoutes.js';
import exploreRoutes from './modules/explore/interfaces/http/exploreRoutes.js';
import exploreEnrichmentJob from './modules/explore/application/jobs/ExploreEnrichmentJob.js';

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Trust proxy (for production behind load balancer)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          'http://localhost:5000',
          'https://api.cloudinary.com',
          'https://*.cloudinary.com',
          'https://*.mapbox.com',
          'https://api.mapbox.com',
          'https://events.mapbox.com',
          'wss://*.mapbox.com',
        ],
        mediaSrc: ["'self'", 'https://*.cloudinary.com'],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page',
      'X-Limit',
      'X-Request-Id',
      'X-Response-Time',
    ],
  }));

  // Gzip compression (skip SSE streams)
  app.use(compression({
    threshold: 1024,
    filter(req, res) {
      if (res.getHeader('Content-Type') === 'text/event-stream') {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later.',
      },
    },
  });
  app.use('/api/', limiter);

  // More aggressive rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts, please try again later.',
      },
    },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  // Request timing and correlation ID
  app.use(requestMetrics);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parsing
  app.use(cookieParser());

  // Initialize Passport
  app.use(passport.initialize());

  // Configure Google OAuth strategy
  configureGoogleStrategy(googleAuthUseCase.buildVerifyCallback());

  // Liveness probe — proves the process is alive
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe — checks critical dependencies
  app.get('/ready', async (req, res) => {
    const checks = { database: 'ok', cache: 'ok' };
    let allOk = true;

    const withTimeout = (promise, ms) => {
      const timer = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('timeout')),
          ms
        )
      );
      return Promise.race([promise, timer]);
    };

    try {
      await withTimeout(
        prisma.$queryRawUnsafe('SELECT 1'),
        3000
      );
    } catch {
      checks.database = 'error';
      allOk = false;
    }

    try {
      await withTimeout(
        cacheService.get('health-check'),
        3000
      );
    } catch {
      checks.cache = 'error';
      allOk = false;
    }

    const status = allOk ? 'ready' : 'not_ready';
    res.status(allOk ? 200 : 503).json({ status, checks });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/trips', tripRoutes);

  // OpenAI-compatible proxy routes
  app.use('/v1', openaiProxyRoutes);

  // Cache management routes
  app.use('/api/cache', cacheRoutes);

  // Config routes (provides API keys to authenticated users)
  app.use('/api/config', configRoutes);

  // Image asset routes
  app.use('/api/images', imageRoutes);

  // Notification routes
  app.use('/api/notifications', notificationRoutes);

  // Collection routes
  app.use('/api/collections', collectionRoutes);

  // Activity vote routes
  app.use('/api/votes', activityVoteRoutes);

  // Story routes
  app.use('/api/stories', storyRoutes);

  // Expense routes (note: uses /api prefix, routes include /trips/:tripId/expenses and /expenses/:id)
  app.use('/api', expenseRoutes);

  // Weather routes
  app.use('/api/weather', weatherRoutes);

  // Gamification routes
  app.use('/api/gamification', gamificationRoutes);

  // Flight routes
  app.use('/api/flights', flightRoutes);

  // Event routes
  app.use('/api/events', eventRoutes);

  // Explore routes
  app.use('/api/explore', exploreRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'ATrips API',
      version: '1.0.0',
      description: 'AI-powered travel planning platform',
      documentation: '/api/docs',
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize cache service
    await cacheService.init();

    // Initialize image pipeline (R2 + BullMQ) — non-blocking
    const r2Ready = r2StorageService.init();
    if (r2Ready) {
      imageQueueService.init(processImageIngestJob);
    }

    // Initialize explore enrichment job
    exploreEnrichmentJob.init();

    // Create app
    const app = createApp();

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(`
  ================================================
    ATrips Backend Server
  ================================================
    Environment: ${config.nodeEnv}
    Port:        ${config.port}
    Frontend:    ${config.frontendUrl}
  ================================================
      `);
    });

    // Consolidated graceful shutdown
    function gracefulShutdown(signal) {
      logger.info(
        `[Shutdown] ${signal} received, shutting down gracefully`
      );
      server.close(async () => {
        logger.info('[Shutdown] HTTP server closed');
        try {
          await imageQueueService.close();
          logger.info('[Shutdown] Image queue closed');
        } catch { /* ignore */ }
        try {
          await exploreEnrichmentJob.close();
        } catch { /* ignore */ }
        try {
          await prisma.$disconnect();
          logger.info('[Shutdown] Database disconnected');
        } catch { /* ignore */ }
        try {
          await cacheService.close();
          logger.info('[Shutdown] Cache closed');
        } catch { /* ignore */ }
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.warn('[Shutdown] Forced exit after timeout');
        process.exit(1);
      }, 10_000).unref();
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { createApp };
