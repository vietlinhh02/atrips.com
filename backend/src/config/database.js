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
    log: ['error', 'warn'],
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

export default prisma;
