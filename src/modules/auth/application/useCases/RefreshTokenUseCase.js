/**
 * Refresh Token Use Case
 * Handles token refresh with rotation
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';

export class RefreshTokenUseCase {
  /**
   * Execute token refresh
   * @param {string} refreshToken - Current refresh token
   * @param {object} metadata - Session metadata
   * @returns {Promise<object>} - New tokens
   */
  async execute(refreshToken, metadata = {}) {
    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    // Verify and rotate tokens
    const { tokens, user } = await authService.refreshTokens(refreshToken);

    // Invalidate old session
    await authService.invalidateSession(refreshToken);

    // Create new session with new refresh token
    await authService.createSession(user.id, tokens.refreshToken, metadata);

    // Get updated user info
    const userWithSub = await userRepository.findByIdWithSubscription(user.id);

    return {
      tokens,
      user: {
        id: userWithSub.id,
        email: userWithSub.email,
        name: userWithSub.name,
        displayName: userWithSub.displayName || userWithSub.name,
        avatarUrl: userWithSub.avatarUrl,
        emailVerified: userWithSub.emailVerified,
        subscription: userWithSub.subscriptions ? {
          tier: userWithSub.subscriptions.tier,
          status: userWithSub.subscriptions.status,
        } : { tier: 'FREE', status: 'TRIAL' },
      },
    };
  }
}

export default new RefreshTokenUseCase();
