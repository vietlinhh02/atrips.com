/**
 * Config Routes
 * Provides frontend configuration including API keys
 * Keys are only exposed to authenticated users
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { authenticate, optionalAuth } from '../../middleware/authenticate.js';
import config from '../../../config/index.js';

const router = Router();

/**
 * Public config (no authentication required)
 * Only non-sensitive configuration
 */
const PUBLIC_CONFIG = {
  appName: 'ATrips',
  appVersion: '1.0.0',
  features: {
    aiChat: true,
    tripPlanning: true,
    mapView: true,
  },
};

/**
 * Private config (requires authentication)
 * Contains API keys that should not be exposed publicly
 */
const getPrivateConfig = () => ({
  mapbox: {
    // Use public token (with URL restrictions) for frontend
    // Create this token in Mapbox dashboard with domain restrictions
    accessToken: config.mapbox?.publicToken || config.mapbox?.accessToken || null,
    style: 'mapbox://styles/mapbox/streets-v12',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    // Only expose cloud name, not API key/secret
  },
});

/**
 * @route GET /api/config
 * @desc Get public configuration
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    ...PUBLIC_CONFIG,
    timestamp: new Date().toISOString(),
  });
}));

/**
 * @route GET /api/config/map
 * @desc Get map configuration including Mapbox token
 * @access Private (authenticated users only)
 */
router.get('/map', authenticate, asyncHandler(async (req, res) => {
  const mapboxToken = config.mapbox?.publicToken || config.mapbox?.accessToken;

  if (!mapboxToken) {
    return sendSuccess(res, {
      enabled: false,
      message: 'Map service not configured',
    });
  }

  const mapConfig = {
    enabled: true,
    provider: 'mapbox',
    accessToken: mapboxToken,
    style: 'mapbox://styles/mapbox/streets-v12',
    options: {
      defaultCenter: [106.6297, 10.8231], // Ho Chi Minh City
      defaultZoom: 12,
      maxZoom: 18,
      minZoom: 2,
    },
  };

  // Also set cookie for caching (30 minutes)
  // httpOnly: false so JavaScript can read it
  res.cookie('atrips_map_config', JSON.stringify(mapConfig), {
    maxAge: 30 * 60 * 1000, // 30 minutes
    httpOnly: false, // Allow JS to read
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
    path: '/',
  });

  return sendSuccess(res, mapConfig);
}));

/**
 * @route GET /api/config/all
 * @desc Get all configuration for authenticated users
 * @access Private
 */
router.get('/all', authenticate, asyncHandler(async (req, res) => {
  const privateConfig = getPrivateConfig();

  return sendSuccess(res, {
    ...PUBLIC_CONFIG,
    ...privateConfig,
    user: {
      id: req.user.id,
      email: req.user.email,
    },
    timestamp: new Date().toISOString(),
  });
}));

/**
 * @route GET /api/config/features
 * @desc Get feature flags (optionally personalized for authenticated users)
 * @access Public (enhanced for authenticated users)
 */
router.get('/features', optionalAuth, asyncHandler(async (req, res) => {
  const features = {
    ...PUBLIC_CONFIG.features,
  };

  // Add user-specific features if authenticated
  if (req.user) {
    features.personalizedRecommendations = true;
    features.savedTrips = true;
    features.aiAssistant = true;
  }

  return sendSuccess(res, { features });
}));

export default router;
