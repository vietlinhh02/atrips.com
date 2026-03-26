/**
 * Login Use Case
 * Handles user login with email/password
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import { Email } from '../../domain/valueObjects/Email.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';
import config from '../../../../config/index.js';
import novuService from '../../../notification/application/NovuService.js';

export class LoginUseCase {
  /**
   * Execute user login
   * @param {object} input - Login input
   * @param {string} input.email - User email
   * @param {string} input.password - User password
   * @param {object} input.metadata - Session metadata (userAgent, ipAddress)
   * @returns {Promise<object>} - User and tokens
   */
  async execute({ email, password, metadata = {} }) {
    // Validate email format
    const emailVO = new Email(email);

    // Find user with password
    const userRecord = await userRepository.findByEmailWithPassword(emailVO.value);

    if (!userRecord) {
      throw AppError.invalidCredentials();
    }

    // Check if account is active
    if (!userRecord.isActive || userRecord.deletedAt) {
      throw AppError.accountDisabled();
    }

    // Check if user has password (might be OAuth-only account)
    if (!userRecord.passwordHash) {
      throw AppError.badRequest(
        'This account was created with Google. Please use Google to sign in.'
      );
    }

    // Verify password
    const isPasswordValid = await authService.verifyPassword(password, userRecord.passwordHash);

    if (!isPasswordValid) {
      throw AppError.invalidCredentials();
    }

    // Check email verification if required
    if (config.features.emailVerificationRequired && !userRecord.emailVerified) {
      // Resend OTP so user has a fresh code on the verify page
      const { otp } = await authService.createEmailVerificationToken(
        userRecord.email,
      );
      const { sendVerificationEmail } = await import(
        '../../../../shared/utils/email.js'
      );
      await sendVerificationEmail(
        userRecord.email,
        otp,
        userRecord.name || '',
      );
      throw AppError.emailNotVerified();
    }

    // Update last login
    await userRepository.updateLastLogin(userRecord.id);

    // Generate tokens
    const tokens = authService.generateTokens({
      id: userRecord.id,
      email: userRecord.email,
    });

    // Create session record
    await authService.createSession(userRecord.id, tokens.refreshToken, metadata);

    // Prepare user response (exclude password)
    const user = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      displayName: userRecord.displayName || userRecord.name,
      avatarUrl: userRecord.avatarUrl,
      bio: userRecord.bio,
      emailVerified: userRecord.emailVerified,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
    };

    // Sync subscriber to Novu (upsert)
    novuService.initSubscriber({
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });

    return {
      user,
      tokens,
    };
  }
}

export default new LoginUseCase();
