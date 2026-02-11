/**
 * Authentication Middleware
 * Validates JWT tokens from cookies or Authorization header
 */

import { verifyAccessToken, extractToken, TOKEN_TYPES } from '../utils/jwt.js';
import { AppError } from '../errors/AppError.js';
import prisma from '../../config/database.js';

/**
 * Authenticate user from JWT token
 * Requires valid access token in cookie or Authorization header
 */
export async function authenticate(req, res, next) {
  try {
    // Extract token from cookie or header
    const token = extractToken(req, TOKEN_TYPES.ACCESS);

    if (!token) {
      throw AppError.unauthorized('Authentication required');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        emailVerified: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        subscriptions: {
          select: {
            tier: true,
            status: true,
            aiQuotaUsed: true,
            aiQuotaLimit: true,
            tripsCreated: true,
            tripsLimit: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (!user.isActive || user.deletedAt) {
      throw AppError.accountDisabled();
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      phone: user.phone,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      subscription: user.subscriptions || {
        tier: 'FREE',
        status: 'TRIAL',
        aiQuotaUsed: 0,
        aiQuotaLimit: 10,
        tripsCreated: 0,
        tripsLimit: 3,
      },
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication
 * Attaches user to request if valid token exists, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req, TOKEN_TYPES.ACCESS);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        phone: true,
        emailVerified: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        subscriptions: {
          select: {
            tier: true,
            status: true,
            aiQuotaUsed: true,
            aiQuotaLimit: true,
            tripsCreated: true,
            tripsLimit: true,
          },
        },
      },
    });

    if (user && user.isActive && !user.deletedAt) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        phone: user.phone,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        subscription: user.subscriptions || {
          tier: 'FREE',
          status: 'TRIAL',
          aiQuotaUsed: 0,
          aiQuotaLimit: 10,
          tripsCreated: 0,
          tripsLimit: 3,
        },
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Token invalid, but that's okay for optional auth
    if (process.env.DEBUG_AUTH) {
      console.debug('Optional auth failed:', error.message);
    }
    req.user = null;
    next();
  }
}

/**
 * Require email verification
 * Use after authenticate middleware
 */
export function requireEmailVerified(req, res, next) {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }

  if (!req.user.emailVerified) {
    return next(AppError.emailNotVerified());
  }

  next();
}

export default {
  authenticate,
  optionalAuth,
  requireEmailVerified,
};
