/**
 * Shared Module Exports
 * Clean exports for shared utilities and middleware
 */

// Errors
export { AppError } from './errors/AppError.js';

// Middleware
export { authenticate, optionalAuth, requireEmailVerified } from './middleware/authenticate.js';
export { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
export {
  requireSubscription,
  requirePro,
  requireBusiness,
  requireAIQuota,
  requireTripQuota,
  attachSubscriptionInfo,
  requireFeature,
} from './middleware/requireSubscription.js';

// Utilities
export {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendError,
  sendPaginated,
  sendValidationError,
} from './utils/response.js';

export {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  extractToken,
  generateRandomToken,
  generateOTP,
  TOKEN_TYPES,
} from './utils/jwt.js';

export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from './utils/email.js';
