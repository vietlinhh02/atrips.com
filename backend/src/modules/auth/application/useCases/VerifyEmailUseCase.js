/**
 * Verify Email Use Case
 * Handles email verification via token
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';

export class VerifyEmailUseCase {
  /**
   * Execute email verification
   * @param {string} token - Verification token
   * @returns {Promise<object>} - Response message and user
   */
  async execute(token) {
    // Verify token
    const tokenRecord = await authService.verifyEmailToken(token);

    // Find user by email
    const user = await userRepository.findByEmail(tokenRecord.email);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Check if already verified
    if (user.emailVerified) {
      return {
        message: 'Email has already been verified.',
        alreadyVerified: true,
      };
    }

    // Verify the email
    await userRepository.verifyEmail(user.id);

    // Mark token as used
    await userRepository.markEmailVerificationTokenUsed(token);

    return {
      message: 'Email verified successfully. You can now use all features.',
      alreadyVerified: false,
    };
  }
}

export default new VerifyEmailUseCase();
