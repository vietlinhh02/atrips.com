/**
 * Verify Email Use Case
 * Handles email verification via token or OTP
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';

export class VerifyEmailUseCase {
  /**
   * Execute email verification via long token (link-based)
   * @param {string} token - Verification token
   * @returns {Promise<object>} - Response message and user
   */
  async execute(token) {
    const tokenRecord = await authService.verifyEmailToken(token);
    return this._verifyUser(tokenRecord);
  }

  /**
   * Execute email verification via OTP
   * @param {string} otp - 6-digit OTP code
   * @param {string} email - User email
   * @returns {Promise<object>} - Response message and user
   */
  async executeWithOTP(otp, email) {
    const tokenRecord = await authService.verifyEmailOTP(otp, email);
    return this._verifyUser(tokenRecord);
  }

  async _verifyUser(tokenRecord) {
    const user = await userRepository.findByEmail(tokenRecord.email);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'Email has already been verified.',
        alreadyVerified: true,
      };
    }

    await userRepository.verifyEmail(user.id);
    await userRepository.markEmailVerificationTokenUsed(tokenRecord.token);

    return {
      message: 'Email verified successfully. You can now use all features.',
      alreadyVerified: false,
    };
  }
}

export default new VerifyEmailUseCase();
