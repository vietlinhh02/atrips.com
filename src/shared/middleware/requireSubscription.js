/**
 * Subscription/Paywall Middleware
 * Checks user subscription tier before allowing access to premium features
 */

import { AppError } from '../errors/AppError.js';

// Subscription tier hierarchy (higher index = higher tier)
const TIER_HIERARCHY = ['FREE', 'PRO', 'BUSINESS'];

// Active subscription statuses
const ACTIVE_STATUSES = ['TRIAL', 'ACTIVE'];

/**
 * Check if subscription tier meets minimum requirement
 * @param {string} userTier - User's current subscription tier
 * @param {string} requiredTier - Minimum required tier
 * @returns {boolean}
 */
function tierMeetsRequirement(userTier, requiredTier) {
  const userIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

/**
 * Require minimum subscription tier
 * @param {string} requiredTier - Minimum required tier ('FREE', 'PRO', 'BUSINESS')
 * @returns {Function} - Express middleware
 */
export function requireSubscription(requiredTier = 'PRO') {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const subscription = req.user.subscription;

    // Check if subscription status is active
    if (!ACTIVE_STATUSES.includes(subscription.status)) {
      return next(AppError.subscriptionRequired(requiredTier));
    }

    // Check tier hierarchy
    if (!tierMeetsRequirement(subscription.tier, requiredTier)) {
      return next(AppError.subscriptionRequired(requiredTier));
    }

    next();
  };
}

/**
 * Check AI quota before allowing AI features
 * @returns {Function} - Express middleware
 */
export function requireAIQuota(req, res, next) {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }

  const subscription = req.user.subscription;

  if (subscription.aiQuotaUsed >= subscription.aiQuotaLimit) {
    return next(AppError.quotaExceeded('AI requests'));
  }

  next();
}

/**
 * Check trip creation quota
 * @returns {Function} - Express middleware
 */
export function requireTripQuota(req, res, next) {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }

  const subscription = req.user.subscription;

  // Business tier has unlimited trips
  if (subscription.tier === 'BUSINESS') {
    return next();
  }

  if (subscription.tripsCreated >= subscription.tripsLimit) {
    return next(AppError.quotaExceeded('trip creation'));
  }

  next();
}

/**
 * Require PRO tier or higher
 * Shorthand for requireSubscription('PRO')
 */
export function requirePro(req, res, next) {
  return requireSubscription('PRO')(req, res, next);
}

/**
 * Require BUSINESS tier
 * Shorthand for requireSubscription('BUSINESS')
 */
export function requireBusiness(req, res, next) {
  return requireSubscription('BUSINESS')(req, res, next);
}

/**
 * Get user's subscription info and limits
 * Attaches subscription details to request
 */
export function attachSubscriptionInfo(req, res, next) {
  if (!req.user) {
    return next();
  }

  const subscription = req.user.subscription;
  const tier = subscription.tier;

  // Define feature limits per tier
  const tierLimits = {
    FREE: {
      maxTrips: 3,
      maxAIQueries: 10,
      maxCollaborators: 0,
      features: ['basic_planning', 'place_search'],
    },
    PRO: {
      maxTrips: 20,
      maxAIQueries: 100,
      maxCollaborators: 5,
      features: ['basic_planning', 'place_search', 'ai_assistant', 'offline_mode', 'budget_tracking'],
    },
    BUSINESS: {
      maxTrips: -1, // Unlimited
      maxAIQueries: 1000,
      maxCollaborators: -1, // Unlimited
      features: ['basic_planning', 'place_search', 'ai_assistant', 'offline_mode', 'budget_tracking', 'team_management', 'analytics', 'white_label'],
    },
  };

  req.subscriptionInfo = {
    tier,
    status: subscription.status,
    limits: tierLimits[tier],
    usage: {
      trips: subscription.tripsCreated,
      aiQueries: subscription.aiQuotaUsed,
    },
    canUpgrade: tier !== 'BUSINESS',
  };

  next();
}

/**
 * Check if user has access to a specific feature
 * @param {string} feature - Feature name to check
 * @returns {Function} - Express middleware
 */
export function requireFeature(feature) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Ensure subscription info is attached
    if (!req.subscriptionInfo) {
      attachSubscriptionInfo(req, res, () => {
        if (!req.subscriptionInfo.limits.features.includes(feature)) {
          return next(AppError.forbidden(`Feature '${feature}' requires a higher subscription tier`));
        }
        next();
      });
      return;
    }

    if (!req.subscriptionInfo.limits.features.includes(feature)) {
      return next(AppError.forbidden(`Feature '${feature}' requires a higher subscription tier`));
    }

    next();
  };
}

export default {
  requireSubscription,
  requireAIQuota,
  requireTripQuota,
  requirePro,
  requireBusiness,
  attachSubscriptionInfo,
  requireFeature,
};
