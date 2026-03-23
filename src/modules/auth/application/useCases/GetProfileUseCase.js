/**
 * Get Profile Use Case
 * Handles fetching user profile and subscription info
 */

import { AppError } from '../../../../shared/errors/AppError.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';

export class GetProfileUseCase {
  /**
   * Execute get current user profile
   * @param {string} userId - User ID
   * @returns {Promise<object>} - User profile
   */
  async execute(userId) {
    const profile = await userRepository.findFullProfile(userId);

    if (!profile) {
      throw AppError.notFound('User not found');
    }

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        displayName: profile.displayName || profile.name,
        avatarUrl: profile.avatarUrl,
        coverImageUrl: profile.coverImageUrl || null,
        coverImageOffsetY: profile.coverImageOffsetY ?? 50,
        bio: profile.bio,
        emailVerified: profile.emailVerified,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
      subscription: profile.subscriptions ? {
        tier: profile.subscriptions.tier,
        status: profile.subscriptions.status,
        usage: {
          aiQueries: profile.subscriptions.aiQuotaUsed,
          aiLimit: profile.subscriptions.aiQuotaLimit,
          trips: profile.subscriptions.tripsCreated,
          tripsLimit: profile.subscriptions.tripsLimit,
        },
        currentPeriod: {
          start: profile.subscriptions.currentPeriodStart,
          end: profile.subscriptions.currentPeriodEnd,
        },
      } : {
        tier: 'FREE',
        status: 'TRIAL',
        usage: {
          aiQueries: 0,
          aiLimit: 10,
          trips: 0,
          tripsLimit: 3,
        },
        currentPeriod: null,
      },
      preferences: profile.UserPreference || {
        language: 'en',
        currency: 'USD',
        timezone: 'UTC',
        emailNotifications: true,
        pushNotifications: true,
        profileVisibility: 'public',
      },
      authProviders: profile.UserAuthProvider?.map(p => ({
        provider: p.provider,
        lastLoginAt: p.lastLoginAt,
      })) || [],
    };
  }

  /**
   * Get user subscription status
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Subscription info
   */
  async getSubscription(userId) {
    const userWithSub = await userRepository.findByIdWithSubscription(userId);

    if (!userWithSub) {
      throw AppError.notFound('User not found');
    }

    const subscription = userWithSub.subscriptions;

    if (!subscription) {
      return {
        tier: 'FREE',
        status: 'TRIAL',
        usage: {
          aiQueries: 0,
          aiLimit: 10,
          trips: 0,
          tripsLimit: 3,
        },
        limits: this.getTierLimits('FREE'),
        features: this.getTierFeatures('FREE'),
      };
    }

    return {
      tier: subscription.tier,
      status: subscription.status,
      usage: {
        aiQueries: subscription.aiQuotaUsed,
        aiLimit: subscription.aiQuotaLimit,
        trips: subscription.tripsCreated,
        tripsLimit: subscription.tripsLimit,
      },
      currentPeriod: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
      trialEndsAt: subscription.trialEndsAt,
      canceledAt: subscription.canceledAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      limits: this.getTierLimits(subscription.tier),
      features: this.getTierFeatures(subscription.tier),
    };
  }

  /**
   * Get limits for a subscription tier
   * @param {string} tier - Subscription tier
   * @returns {object} - Tier limits
   */
  getTierLimits(tier) {
    const limits = {
      FREE: {
        maxTrips: 3,
        maxAIQueries: 10,
        maxCollaboratorsPerTrip: 0,
        maxPhotosPerTrip: 10,
        offlineMaps: false,
        advancedAnalytics: false,
      },
      PRO: {
        maxTrips: 20,
        maxAIQueries: 100,
        maxCollaboratorsPerTrip: 5,
        maxPhotosPerTrip: 100,
        offlineMaps: true,
        advancedAnalytics: true,
      },
      BUSINESS: {
        maxTrips: -1, // Unlimited
        maxAIQueries: 1000,
        maxCollaboratorsPerTrip: -1, // Unlimited
        maxPhotosPerTrip: -1, // Unlimited
        offlineMaps: true,
        advancedAnalytics: true,
      },
    };

    return limits[tier] || limits.FREE;
  }

  /**
   * Get features for a subscription tier
   * @param {string} tier - Subscription tier
   * @returns {string[]} - List of features
   */
  getTierFeatures(tier) {
    const features = {
      FREE: [
        'basic_trip_planning',
        'place_discovery',
        'limited_ai_assistant',
        'basic_itinerary',
      ],
      PRO: [
        'basic_trip_planning',
        'place_discovery',
        'unlimited_ai_assistant',
        'advanced_itinerary',
        'budget_tracking',
        'offline_mode',
        'trip_collaboration',
        'weather_integration',
        'export_to_pdf',
      ],
      BUSINESS: [
        'basic_trip_planning',
        'place_discovery',
        'unlimited_ai_assistant',
        'advanced_itinerary',
        'budget_tracking',
        'offline_mode',
        'trip_collaboration',
        'weather_integration',
        'export_to_pdf',
        'team_management',
        'advanced_analytics',
        'api_access',
        'white_label',
        'priority_support',
      ],
    };

    return features[tier] || features.FREE;
  }
}

export default new GetProfileUseCase();
