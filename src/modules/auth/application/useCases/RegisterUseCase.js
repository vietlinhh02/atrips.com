/**
 * Register Use Case
 * Handles user registration with email/password
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import { Email } from '../../domain/valueObjects/Email.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';
import config from '../../../../config/index.js';
import novuService from '../../../notification/application/NovuService.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../../../../shared/utils/email.js';

export class RegisterUseCase {
  /**
   * Execute user registration
   * @param {object} input - Registration input
   * @param {string} input.email - User email
   * @param {string} input.password - User password
   * @param {string} input.name - User name (optional)
   * @returns {Promise<object>} - Created user and tokens
   */
  async execute({ email, password, name }) {
    // Validate email
    const emailVO = new Email(email);

    // Validate password strength
    authService.validatePasswordStrength(password);

    // Check if email already exists
    const existingUser = await userRepository.emailExists(emailVO.value);
    if (existingUser) {
      throw AppError.emailAlreadyExists();
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const user = await userRepository.createWithEmail(
      {
        email: emailVO.value,
        name: name || null,
        displayName: name || null,
      },
      passwordHash
    );

    // Generate tokens
    const tokens = authService.generateTokens({
      id: user.id,
      email: user.email,
    });

    // Sync subscriber to Novu then send email via Novu
    await novuService.initSubscriber({
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
    });

    if (config.features.emailVerificationRequired) {
      const { otp } = await authService.createEmailVerificationToken(
        user.email,
      );
      await sendVerificationEmail(user.email, otp, user.name || '');
    } else {
      await sendWelcomeEmail(user.email, user.name || '');
    }

    return {
      user: user.toJSON(),
      tokens,
      message: config.features.emailVerificationRequired
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. Welcome to ATrips!',
    };
  }
}

export default new RegisterUseCase();
