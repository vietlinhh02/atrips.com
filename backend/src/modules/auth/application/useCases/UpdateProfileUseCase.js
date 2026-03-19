/**
 * Update Profile Use Case
 * Handles user profile updates
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';

export class UpdateProfileUseCase {
  /**
   * Execute profile update
   * @param {string} userId - User ID
   * @param {object} updates - Profile updates
   * @returns {Promise<object>} - Updated user profile
   */
  async execute(userId, updates) {
    // Find user
    const user = await userRepository.findById(userId);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Filter allowed fields for profile update
    const allowedFields = ['name', 'displayName', 'avatarUrl', 'coverImageUrl', 'bio', 'phone'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    // If no valid fields, return current user without error
    if (Object.keys(filteredUpdates).length === 0) {
      return {
        user: user.toJSON ? user.toJSON() : user,
        message: 'No changes made',
      };
    }

    // Validate name length
    if (filteredUpdates.name !== undefined && filteredUpdates.name.length > 100) {
      throw AppError.badRequest('Name must be 100 characters or less');
    }

    // Validate displayName length
    if (filteredUpdates.displayName !== undefined && filteredUpdates.displayName.length > 50) {
      throw AppError.badRequest('Display name must be 50 characters or less');
    }

    // Validate bio length
    if (filteredUpdates.bio !== undefined && filteredUpdates.bio.length > 500) {
      throw AppError.badRequest('Bio must be 500 characters or less');
    }

    // Validate avatar URL
    if (filteredUpdates.avatarUrl !== undefined && filteredUpdates.avatarUrl !== null) {
      if (filteredUpdates.avatarUrl.length > 0) {
        try {
          const avatarUrl = new URL(filteredUpdates.avatarUrl);
          if (!['http:', 'https:'].includes(avatarUrl.protocol)) {
            throw AppError.badRequest('Avatar URL must use HTTP or HTTPS protocol');
          }
        } catch (error) {
          throw AppError.badRequest('Invalid avatar URL: ' + error.message);
        }
      }
    }

    // Validate cover image URL
    if (filteredUpdates.coverImageUrl !== undefined && filteredUpdates.coverImageUrl !== null) {
      if (filteredUpdates.coverImageUrl.length > 0) {
        try {
          const coverUrl = new URL(filteredUpdates.coverImageUrl);
          if (!['http:', 'https:'].includes(coverUrl.protocol)) {
            throw AppError.badRequest('Cover image URL must use HTTP or HTTPS protocol');
          }
        } catch (error) {
          throw AppError.badRequest('Invalid cover image URL: ' + error.message);
        }
      }
    }

    // Update user
    const updatedUser = await userRepository.update(userId, filteredUpdates);

    return {
      user: updatedUser.toJSON(),
      message: 'Profile updated successfully',
    };
  }

  /**
   * Execute preferences update
   * @param {string} userId - User ID
   * @param {object} preferences - Preference updates
   * @returns {Promise<object>} - Updated preferences
   */
  async updatePreferences(userId, preferences) {
    // Validate user exists
    const user = await userRepository.findById(userId);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Filter allowed preference fields
    const allowedFields = [
      'language',
      'currency',
      'timezone',
      'travelStyle',
      'budgetRange',
      'dietaryRestrictions',
      'accessibilityNeeds',
      'emailNotifications',
      'pushNotifications',
      'profileVisibility',
    ];

    const filteredPreferences = {};

    for (const field of allowedFields) {
      if (preferences[field] !== undefined) {
        filteredPreferences[field] = preferences[field];
      }
    }

    // Validate language code
    if (filteredPreferences.language !== undefined) {
      const validLanguages = ['en', 'vi', 'es', 'fr', 'de', 'ja', 'ko', 'zh'];
      if (!validLanguages.includes(filteredPreferences.language)) {
        throw AppError.badRequest('Invalid language code');
      }
    }

    // Validate currency code
    if (filteredPreferences.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'VND', 'JPY', 'KRW', 'CNY', 'THB'];
      if (!validCurrencies.includes(filteredPreferences.currency)) {
        throw AppError.badRequest('Invalid currency code');
      }
    }

    // Validate profile visibility
    if (filteredPreferences.profileVisibility !== undefined) {
      const validVisibilities = ['public', 'private', 'friends'];
      if (!validVisibilities.includes(filteredPreferences.profileVisibility)) {
        throw AppError.badRequest('Invalid profile visibility');
      }
    }

    // Update preferences
    const updatedPreferences = await userRepository.updatePreferences(userId, filteredPreferences);

    return {
      preferences: updatedPreferences,
      message: 'Preferences updated successfully',
    };
  }
}

export default new UpdateProfileUseCase();
