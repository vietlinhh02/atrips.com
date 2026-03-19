/**
 * User Repository
 * Handles all database operations for users and related entities
 * Includes caching support for frequently accessed data
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { User } from '../../domain/entities/User.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  USER_BASIC: 1800,          // 30 minutes
  USER_PROFILE: 1800,        // 30 minutes
  USER_SUBSCRIPTION: 1200,   // 20 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  USER_BASIC: (id) => `user:basic:${id}`,
  USER_PROFILE: (id) => `user:profile:${id}`,
  USER_SUBSCRIPTION: (id) => `user:subscription:${id}`,
  USER_BY_EMAIL: (email) => `user:email:${email.toLowerCase()}`,
};

export class UserRepository {
  /**
   * Find user by ID (cached)
   * @param {string} id - User ID
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    const cacheKey = CACHE_KEYS.USER_BASIC(id);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return User.fromPersistence(cached);
    }

    const record = await prisma.user.findUnique({
      where: { id },
    });

    if (record) {
      await cacheService.set(cacheKey, record, CACHE_TTL.USER_BASIC);
    }

    return record ? User.fromPersistence(record) : null;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    const cacheKey = CACHE_KEYS.USER_BY_EMAIL(email);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return User.fromPersistence(cached);
    }

    const record = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (record) {
      await cacheService.set(cacheKey, record, CACHE_TTL.USER_BASIC);
    }

    return record ? User.fromPersistence(record) : null;
  }

  /**
   * Find user by email with password hash (for authentication)
   * NOT cached for security reasons
   * @param {string} email - User email
   * @returns {Promise<object|null>}
   */
  async findByEmailWithPassword(email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        emailVerified: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  /**
   * Find user with auth provider
   * @param {string} provider - Auth provider (EMAIL, GOOGLE)
   * @param {string} providerUserId - Provider user ID
   * @returns {Promise<object|null>}
   */
  async findByAuthProvider(provider, providerUserId) {
    const authProvider = await prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            emailVerified: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return authProvider?.User || null;
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    const count = await prisma.user.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Create a new user with email provider
   * @param {object} userData - User data
   * @param {string} passwordHash - Hashed password
   * @returns {Promise<User>}
   */
  async createWithEmail(userData, passwordHash) {
    const record = await prisma.user.create({
      data: {
        email: userData.email.toLowerCase(),
        passwordHash,
        name: userData.name || null,
        displayName: userData.displayName || userData.name || null,
        emailVerified: false,
        isActive: true,
        UserAuthProvider: {
          create: {
            provider: 'EMAIL',
            providerUserId: userData.email.toLowerCase(),
          },
        },
        subscriptions: {
          create: {
            tier: 'FREE',
            status: 'TRIAL',
            aiQuotaUsed: 0,
            aiQuotaLimit: 10,
            tripsCreated: 0,
            tripsLimit: 3,
          },
        },
        UserPreference: {
          create: {
            language: 'en',
            currency: 'USD',
            timezone: 'UTC',
          },
        },
      },
    });

    return User.fromPersistence(record);
  }

  /**
   * Create a new user with Google OAuth
   * @param {object} profile - Google profile
   * @returns {Promise<User>}
   */
  async createWithGoogle(profile) {
    const record = await prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        name: profile.name || null,
        displayName: profile.displayName || profile.name || null,
        avatarUrl: profile.avatarUrl || null,
        emailVerified: true, // Google emails are pre-verified
        isActive: true,
        UserAuthProvider: {
          create: {
            provider: 'GOOGLE',
            providerUserId: profile.googleId,
            accessToken: profile.accessToken || null,
            refreshToken: profile.refreshToken || null,
            tokenExpiresAt: profile.tokenExpiresAt || null,
            lastLoginAt: new Date(),
          },
        },
        subscriptions: {
          create: {
            tier: 'FREE',
            status: 'TRIAL',
            aiQuotaUsed: 0,
            aiQuotaLimit: 10,
            tripsCreated: 0,
            tripsLimit: 3,
          },
        },
        UserPreference: {
          create: {
            language: 'en',
            currency: 'USD',
            timezone: 'UTC',
          },
        },
      },
    });

    return User.fromPersistence(record);
  }

  /**
   * Link Google provider to existing user
   * @param {string} userId - User ID
   * @param {object} profile - Google profile
   * @returns {Promise<void>}
   */
  async linkGoogleProvider(userId, profile) {
    await prisma.userAuthProvider.create({
      data: {
        userId,
        provider: 'GOOGLE',
        providerUserId: profile.googleId,
        accessToken: profile.accessToken || null,
        refreshToken: profile.refreshToken || null,
        tokenExpiresAt: profile.tokenExpiresAt || null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} updates - Update data
   * @returns {Promise<User>}
   */
  async update(id, updates) {
    const record = await prisma.user.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Invalidate user caches
    await this.invalidateUserCache(id, record.email);

    return User.fromPersistence(record);
  }

  /**
   * Update password
   * @param {string} id - User ID
   * @param {string} passwordHash - New hashed password
   * @returns {Promise<void>}
   */
  async updatePassword(id, passwordHash) {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(id) {
    await prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Verify email
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  async verifyEmail(id) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Invalidate user caches
    await this.invalidateUserCache(id, user.email);
  }

  /**
   * Get user with subscription (cached)
   * @param {string} id - User ID
   * @returns {Promise<object|null>}
   */
  async findByIdWithSubscription(id) {
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(id);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: true,
        UserPreference: true,
      },
    });

    if (result) {
      await cacheService.set(cacheKey, result, CACHE_TTL.USER_SUBSCRIPTION);
    }

    return result;
  }

  /**
   * Get user profile with all related data (cached)
   * @param {string} id - User ID
   * @returns {Promise<object|null>}
   */
  async findFullProfile(id) {
    const cacheKey = CACHE_KEYS.USER_PROFILE(id);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        coverImageUrl: true,
        coverImageOffsetY: true,
        bio: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          select: {
            tier: true,
            status: true,
            aiQuotaUsed: true,
            aiQuotaLimit: true,
            tripsCreated: true,
            tripsLimit: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
        UserPreference: {
          select: {
            language: true,
            currency: true,
            timezone: true,
            travelStyle: true,
            budgetRange: true,
            emailNotifications: true,
            pushNotifications: true,
            profileVisibility: true,
          },
        },
        UserAuthProvider: {
          select: {
            provider: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (result) {
      await cacheService.set(cacheKey, result, CACHE_TTL.USER_PROFILE);
    }

    return result;
  }

  /**
   * Invalidate all user-related caches
   * @param {string} userId - User ID
   * @param {string} email - User email (optional)
   */
  async invalidateUserCache(userId, email = null) {
    const keysToDelete = [
      CACHE_KEYS.USER_BASIC(userId),
      CACHE_KEYS.USER_PROFILE(userId),
      CACHE_KEYS.USER_SUBSCRIPTION(userId),
    ];

    if (email) {
      keysToDelete.push(CACHE_KEYS.USER_BY_EMAIL(email));
    }

    await Promise.all(keysToDelete.map(key => cacheService.del(key)));
  }

  // Email Verification Token methods

  /**
   * Create email verification token
   * @param {string} email - User email
   * @param {string} token - Verification token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<object>}
   */
  async createEmailVerificationToken(email, token, expiresAt) {
    return prisma.email_verification_tokens.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    });
  }

  /**
   * Find email verification token
   * @param {string} token - Verification token
   * @returns {Promise<object|null>}
   */
  async findEmailVerificationToken(token) {
    return prisma.email_verification_tokens.findUnique({
      where: { token },
    });
  }

  /**
   * Mark email verification token as used
   * @param {string} token - Verification token
   * @returns {Promise<void>}
   */
  async markEmailVerificationTokenUsed(token) {
    await prisma.email_verification_tokens.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  // Password Reset Token methods

  /**
   * Create password reset token
   * @param {string} email - User email
   * @param {string} token - Reset token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<object>}
   */
  async createPasswordResetToken(email, token, expiresAt) {
    return prisma.password_reset_tokens.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    });
  }

  /**
   * Find password reset token
   * @param {string} token - Reset token
   * @returns {Promise<object|null>}
   */
  async findPasswordResetToken(token) {
    return prisma.password_reset_tokens.findUnique({
      where: { token },
    });
  }

  /**
   * Mark password reset token as used
   * @param {string} token - Reset token
   * @returns {Promise<void>}
   */
  async markPasswordResetTokenUsed(token) {
    await prisma.password_reset_tokens.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Delete expired tokens (cleanup)
   * @returns {Promise<{emailTokens: number, passwordTokens: number}>}
   */
  async deleteExpiredTokens() {
    const now = new Date();

    const [emailResult, passwordResult] = await Promise.all([
      prisma.email_verification_tokens.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null } },
          ],
        },
      }),
      prisma.password_reset_tokens.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null } },
          ],
        },
      }),
    ]);

    return {
      emailTokens: emailResult.count,
      passwordTokens: passwordResult.count,
    };
  }

  // Session methods

  /**
   * Create session record
   * @param {string} userId - User ID
   * @param {string} token - Session token
   * @param {object} metadata - Session metadata
   * @returns {Promise<object>}
   */
  async createSession(userId, token, metadata = {}) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    return prisma.sessions.create({
      data: {
        userId,
        token,
        userAgent: metadata.userAgent || null,
        ipAddress: metadata.ipAddress || null,
        expiresAt,
        lastAccessAt: new Date(),
      },
    });
  }

  /**
   * Find session by token
   * @param {string} token - Session token
   * @returns {Promise<object|null>}
   */
  async findSession(token) {
    return prisma.sessions.findUnique({
      where: { token },
    });
  }

  /**
   * Update session last access time
   * @param {string} token - Session token
   * @returns {Promise<void>}
   */
  async updateSessionAccess(token) {
    await prisma.sessions.update({
      where: { token },
      data: { lastAccessAt: new Date() },
    });
  }

  /**
   * Delete session
   * @param {string} token - Session token
   * @returns {Promise<void>}
   */
  async deleteSession(token) {
    await prisma.sessions.delete({
      where: { token },
    }).catch(() => {
      // Ignore if session doesn't exist
    });
  }

  /**
   * Delete all sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of deleted sessions
   */
  async deleteAllUserSessions(userId) {
    const result = await prisma.sessions.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Delete expired sessions (cleanup)
   * @returns {Promise<number>} - Number of deleted sessions
   */
  async deleteExpiredSessions() {
    const result = await prisma.sessions.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {object} preferences - Preference updates
   * @returns {Promise<object>}
   */
  async updatePreferences(userId, preferences) {
    const result = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        ...preferences,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...preferences,
      },
    });

    // Invalidate user caches
    await this.invalidateUserCache(userId);

    return result;
  }
}

export default new UserRepository();
