/**
 * ATrips Backend Application
 * Main entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import passport from 'passport';

import config from './config/index.js';
import { connectDatabase, setupDatabaseShutdown } from './config/database.js';
import { configureGoogleStrategy } from './config/passport.js';
import cacheService from './shared/services/CacheService.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
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

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parsing
  app.use(cookieParser());

  // Initialize Passport
  app.use(passport.initialize());

  // Configure Google OAuth strategy
  configureGoogleStrategy(googleAuthUseCase.buildVerifyCallback());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
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

    // Setup graceful shutdown
    setupDatabaseShutdown();

    // Create app
    const app = createApp();

    // Start listening
    const server = app.listen(config.port, () => {
      console.log(`
  ================================================
    ATrips Backend Server
  ================================================
    Environment: ${config.nodeEnv}
    Port:        ${config.port}
    Frontend:    ${config.frontendUrl}
  ================================================
      `);
    });

    // Graceful shutdown for server
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        server.close(async () => {
          console.log('HTTP server closed');
          await cacheService.close();
          console.log('Cache service closed');
        });
      });
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { createApp };
