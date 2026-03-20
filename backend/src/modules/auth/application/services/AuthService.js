/**
 * Auth Service
 * Core authentication service providing shared authentication logic
 */

import bcrypt from 'bcryptjs';
import config from '../../../../config/index.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import {
  generateTokenPair,
  generateRandomToken,
  generateOTP,
  verifyRefreshToken,
} from '../../../../shared/utils/jwt.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';

export class AuthService {
  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, config.bcryptRounds);
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Password hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    if (!hash) {
      return false;
    }
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @throws {AppError} - If password doesn't meet requirements
   */
  validatePasswordStrength(password) {
    const minLength = 8;
    const errors = [];

    if (!password || password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (errors.length > 0) {
      throw AppError.badRequest('Password does not meet requirements', { errors });
    }
  }

  /**
   * Generate authentication tokens for a user
   * @param {object} user - User object
   * @returns {object} - Token pair
   */
  generateTokens(user) {
    return generateTokenPair(user);
  }

  /**
   * Refresh authentication tokens
   * @param {string} refreshToken - Current refresh token
   * @returns {Promise<object>} - New token pair and user
   */
  async refreshTokens(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw AppError.accountDisabled();
    }

    // Generate new tokens (token rotation)
    const tokens = generateTokenPair({
      id: user.id,
      email: user.email,
    });

    return {
      tokens,
      user,
    };
  }

  /**
   * Generate email verification token and OTP
   * @param {string} email - User email
   * @returns {Promise<{token: string, otp: string}>} - Verification token and OTP
   */
  async createEmailVerificationToken(email) {
    const token = generateRandomToken();
    const otp = generateOTP(6);
    const expiresAt = new Date(Date.now() + config.emailVerificationExpires);

    await userRepository.createEmailVerificationToken(
      email, token, expiresAt, otp,
    );

    return { token, otp };
  }

  /**
   * Verify email verification token
   * @param {string} token - Verification token
   * @returns {Promise<object>} - Token record
   */
  async verifyEmailToken(token) {
    const tokenRecord = await userRepository.findEmailVerificationToken(token);

    if (!tokenRecord) {
      throw AppError.invalidToken();
    }

    if (tokenRecord.usedAt) {
      throw AppError.badRequest('This verification link has already been used');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw AppError.tokenExpired();
    }

    return tokenRecord;
  }

  /**
   * Verify email verification OTP
   * @param {string} otp - 6-digit OTP code
   * @param {string} email - User email
   * @returns {Promise<object>} - Token record
   */
  async verifyEmailOTP(otp, email) {
    const tokenRecord = await userRepository.findEmailVerificationByOTP(
      email, otp,
    );

    if (!tokenRecord) {
      throw AppError.badRequest('Invalid verification code');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw AppError.tokenExpired();
    }

    return tokenRecord;
  }

  /**
   * Generate password reset token
   * @param {string} email - User email
   * @returns {Promise<string>} - Reset token
   */
  async createPasswordResetToken(email) {
    const token = generateRandomToken();
    const expiresAt = new Date(Date.now() + config.passwordResetExpires);

    await userRepository.createPasswordResetToken(email, token, expiresAt);

    return token;
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   * @returns {Promise<object>} - Token record
   */
  async verifyPasswordResetToken(token) {
    const tokenRecord = await userRepository.findPasswordResetToken(token);

    if (!tokenRecord) {
      throw AppError.invalidToken();
    }

    if (tokenRecord.usedAt) {
      throw AppError.badRequest('This reset link has already been used');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw AppError.tokenExpired();
    }

    return tokenRecord;
  }

  /**
   * Create or update session
   * @param {string} userId - User ID
   * @param {string} token - Session token (refresh token)
   * @param {object} metadata - Session metadata
   * @returns {Promise<object>}
   */
  async createSession(userId, token, metadata = {}) {
    return userRepository.createSession(userId, token, metadata);
  }

  /**
   * Invalidate session
   * @param {string} token - Session token
   * @returns {Promise<void>}
   */
  async invalidateSession(token) {
    await userRepository.deleteSession(token);
  }

  /**
   * Invalidate all user sessions
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of invalidated sessions
   */
  async invalidateAllUserSessions(userId) {
    return userRepository.deleteAllUserSessions(userId);
  }

  /**
   * Extract session metadata from request
   * @param {object} req - Express request object
   * @returns {object} - Session metadata
   */
  extractSessionMetadata(req) {
    return {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
    };
  }
}

export default new AuthService();
