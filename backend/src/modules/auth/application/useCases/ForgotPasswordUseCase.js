/**
 * Forgot Password Use Case
 * Handles password reset request
 */

import { Email } from '../../domain/valueObjects/Email.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';
import { sendPasswordResetEmail } from '../../../../shared/utils/email.js';

export class ForgotPasswordUseCase {
  /**
   * Execute forgot password request
   * @param {string} email - User email
   * @returns {Promise<object>} - Response message
   */
  async execute(email) {
    // Validate email format
    const emailVO = new Email(email);

    // Find user by email
    const user = await userRepository.findByEmail(emailVO.value);

    // Always return success to prevent email enumeration
    const successMessage = {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };

    if (!user) {
      // User doesn't exist, but don't reveal that
      return successMessage;
    }

    // Check if user has a password (OAuth-only accounts can't reset password)
    const userWithPassword = await userRepository.findByEmailWithPassword(emailVO.value);
    if (!userWithPassword.passwordHash) {
      // This account uses OAuth, but don't reveal that
      return successMessage;
    }

    try {
      // Create password reset token
      const token = await authService.createPasswordResetToken(emailVO.value);

      // Send password reset email
      await sendPasswordResetEmail(emailVO.value, token, user.name);
    } catch (error) {
      // Log error but still return success to prevent enumeration
      console.error('Failed to send password reset email:', error);
    }

    return successMessage;
  }
}

export default new ForgotPasswordUseCase();
