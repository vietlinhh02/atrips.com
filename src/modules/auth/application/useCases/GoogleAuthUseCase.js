/**
 * Google Auth Use Case
 * Handles Google OAuth authentication - creating or linking accounts
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import authService from '../services/AuthService.js';

export class GoogleAuthUseCase {
  /**
   * Execute Google OAuth authentication
   * @param {object} profile - Google profile data
   * @param {string} profile.googleId - Google user ID
   * @param {string} profile.email - User email
   * @param {string} profile.name - User name
   * @param {string} profile.displayName - Display name
   * @param {string} profile.avatarUrl - Profile picture URL
   * @param {string} profile.accessToken - Google access token
   * @param {string} profile.refreshToken - Google refresh token
   * @param {object} metadata - Session metadata
   * @returns {Promise<object>} - User and tokens
   */
  async execute(profile, metadata = {}) {
    // First, check if user already exists with this Google account
    let user = await userRepository.findByAuthProvider('GOOGLE', profile.googleId);

    if (user) {
      // Existing user - update last login and return
      await userRepository.updateLastLogin(user.id);

      const tokens = authService.generateTokens({
        id: user.id,
        email: user.email,
      });

      await authService.createSession(user.id, tokens.refreshToken, metadata);

      return {
        user: this.formatUserResponse(user),
        tokens,
        isNewUser: false,
      };
    }

    // Check if email exists (might be registered with email/password)
    const existingUserByEmail = await userRepository.findByEmail(profile.email);

    if (existingUserByEmail) {
      // Link Google account to existing user
      await userRepository.linkGoogleProvider(existingUserByEmail.id, {
        googleId: profile.googleId,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      });

      // Update avatar if user doesn't have one
      if (!existingUserByEmail.avatarUrl && profile.avatarUrl) {
        await userRepository.update(existingUserByEmail.id, {
          avatarUrl: profile.avatarUrl,
        });
      }

      // Mark email as verified (Google emails are verified)
      if (!existingUserByEmail.emailVerified) {
        await userRepository.verifyEmail(existingUserByEmail.id);
      }

      await userRepository.updateLastLogin(existingUserByEmail.id);

      const userRecord = await userRepository.findById(existingUserByEmail.id);

      const tokens = authService.generateTokens({
        id: userRecord.id,
        email: userRecord.email,
      });

      await authService.createSession(userRecord.id, tokens.refreshToken, metadata);

      return {
        user: this.formatUserResponse(userRecord.toPersistence()),
        tokens,
        isNewUser: false,
        linkedAccount: true,
      };
    }

    // Create new user with Google
    const newUser = await userRepository.createWithGoogle({
      email: profile.email,
      name: profile.name,
      displayName: profile.displayName || profile.name,
      avatarUrl: profile.avatarUrl,
      googleId: profile.googleId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
    });

    const tokens = authService.generateTokens({
      id: newUser.id,
      email: newUser.email,
    });

    await authService.createSession(newUser.id, tokens.refreshToken, metadata);

    return {
      user: newUser.toJSON(),
      tokens,
      isNewUser: true,
    };
  }

  /**
   * Format user response
   * @param {object} user - User record
   * @returns {object} - Formatted user
   */
  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Build Google OAuth verify callback for Passport.js
   * @returns {Function} - Passport verify callback
   */
  buildVerifyCallback() {
    return async (req, accessToken, refreshToken, profile, done) => {
      try {
        const googleProfile = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
          displayName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
          accessToken,
          refreshToken,
        };

        if (!googleProfile.email) {
          return done(AppError.badRequest('Email not provided by Google'), null);
        }

        const metadata = authService.extractSessionMetadata(req);
        const result = await this.execute(googleProfile, metadata);

        // Attach tokens to the result for later use
        done(null, {
          ...result.user,
          tokens: result.tokens,
          isNewUser: result.isNewUser,
        });
      } catch (error) {
        done(error, null);
      }
    };
  }
}

export default new GoogleAuthUseCase();
