/**
 * Reset Password Use Case
 * Handles setting a new password with reset token
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';

export class ResetPasswordUseCase {
  /**
   * Execute password reset
   * @param {object} input - Reset input
   * @param {string} input.token - Password reset token
   * @param {string} input.password - New password
   * @returns {Promise<object>} - Response message
   */
  async execute({ token, password }) {
    // Verify token
    const tokenRecord = await authService.verifyPasswordResetToken(token);

    // Find user by email
    const user = await userRepository.findByEmail(tokenRecord.email);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Validate new password strength
    authService.validatePasswordStrength(password);

    // Hash new password
    const passwordHash = await authService.hashPassword(password);

    // Update password
    await userRepository.updatePassword(user.id, passwordHash);

    // Mark token as used
    await userRepository.markPasswordResetTokenUsed(token);

    // Invalidate all existing sessions for security
    await authService.invalidateAllUserSessions(user.id);

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }
}

export default new ResetPasswordUseCase();
