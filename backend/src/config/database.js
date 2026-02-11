/**
 * Database Configuration
 * Prisma Client singleton instance
 */

import { PrismaClient } from '@prisma/client';
import config from './index.js';

const globalForPrisma = globalThis;

/**
 * Prisma Client singleton
 * Prevents multiple instances during development hot reloads
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.nodeEnv === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database
 */
export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('Database disconnected');
}

/**
 * Graceful shutdown handler
 */
export function setupDatabaseShutdown() {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, closing database connection...`);
      await disconnectDatabase();
      process.exit(0);
    });
  });
}

export default prisma;
