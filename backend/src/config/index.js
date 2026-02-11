/**
 * Application Configuration
 * Loads and validates environment variables
 */

import 'dotenv/config';

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },

  // Email (SMTP)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM || 'ATrips <noreply@atrips.com>',
  },

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  passwordResetExpires: parseInt(process.env.PASSWORD_RESET_EXPIRES, 10) || 3600000, // 1 hour
  emailVerificationExpires: parseInt(process.env.EMAIL_VERIFICATION_EXPIRES, 10) || 86400000, // 24 hours

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Cookie settings
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    httpOnly: true,
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  // Feature flags
  features: {
    emailVerificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED === 'true',
  },

  // Map services
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN,
    // Create a separate public token with URL restrictions for frontend use
    // In Mapbox dashboard: restrict to your domain only
    publicToken: process.env.MAPBOX_PUBLIC_TOKEN || process.env.MAPBOX_ACCESS_TOKEN,
  },
};

export default config;
