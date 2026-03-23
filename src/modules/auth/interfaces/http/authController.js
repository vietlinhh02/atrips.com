/**
 * Auth Controller
 * Handles HTTP requests for authentication endpoints
 */

import { validationResult } from 'express-validator';
import { sendSuccess, sendCreated, sendValidationError } from '../../../../shared/utils/response.js';
import { setAuthCookies, clearAuthCookies, extractToken, TOKEN_TYPES } from '../../../../shared/utils/jwt.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import authService from '../../application/services/AuthService.js';
import registerUseCase from '../../application/useCases/RegisterUseCase.js';
import loginUseCase from '../../application/useCases/LoginUseCase.js';
import refreshTokenUseCase from '../../application/useCases/RefreshTokenUseCase.js';
import forgotPasswordUseCase from '../../application/useCases/ForgotPasswordUseCase.js';
import resetPasswordUseCase from '../../application/useCases/ResetPasswordUseCase.js';
import verifyEmailUseCase from '../../application/useCases/VerifyEmailUseCase.js';
import userRepository from '../../infrastructure/repositories/UserRepository.js';
import novuService from '../../../notification/application/NovuService.js';
import config from '../../../../config/index.js';

/**
 * @route POST /api/auth/register
 * @desc Register a new user with email/password
 * @access Public
 */
export const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { email, password, name } = req.body;

  const result = await registerUseCase.execute({ email, password, name });

  // Set auth cookies
  setAuthCookies(res, result.tokens);

  return sendCreated(res, {
    user: result.user,
  }, result.message);
});

/**
 * @route POST /api/auth/login
 * @desc Login with email/password
 * @access Public
 */
export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { email, password } = req.body;
  const metadata = authService.extractSessionMetadata(req);

  const result = await loginUseCase.execute({ email, password, metadata });

  // Set auth cookies
  setAuthCookies(res, result.tokens);

  return sendSuccess(res, {
    user: result.user,
  }, 'Login successful');
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user (clear cookies)
 * @access Public
 */
export const logout = asyncHandler(async (req, res) => {
  // Get refresh token to invalidate session
  const refreshToken = extractToken(req, TOKEN_TYPES.REFRESH);

  if (refreshToken) {
    try {
      await authService.invalidateSession(refreshToken);
    } catch (error) {
      // Ignore errors when invalidating session
      console.log('Session invalidation error (ignored):', error.message);
    }
  }

  // Clear auth cookies
  clearAuthCookies(res);

  return sendSuccess(res, null, 'Logout successful');
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public (but requires valid refresh token)
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const token = extractToken(req, TOKEN_TYPES.REFRESH);
  const metadata = authService.extractSessionMetadata(req);

  const result = await refreshTokenUseCase.execute(token, metadata);

  // Set new auth cookies
  setAuthCookies(res, result.tokens);

  return sendSuccess(res, {
    user: result.user,
  }, 'Token refreshed successfully');
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset email
 * @access Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { email } = req.body;

  const result = await forgotPasswordUseCase.execute(email);

  return sendSuccess(res, null, result.message);
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { token, password } = req.body;

  const result = await resetPasswordUseCase.execute({ token, password });

  // Clear any existing cookies
  clearAuthCookies(res);

  return sendSuccess(res, null, result.message);
});

/**
 * @route GET /api/auth/verify-email/:token
 * @desc Verify email with token (link-based)
 * @access Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const result = await verifyEmailUseCase.execute(token);

  return sendSuccess(res, {
    alreadyVerified: result.alreadyVerified,
  }, result.message);
});

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email with OTP code
 * @access Public
 */
export const verifyEmailOTP = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { otp, email } = req.body;

  const result = await verifyEmailUseCase.executeWithOTP(otp, email);

  return sendSuccess(res, {
    alreadyVerified: result.alreadyVerified,
  }, result.message);
});

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend email verification OTP
 * @access Public
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { email } = req.body;

  const user = await userRepository.findByEmail(email);
  if (!user) {
    return sendSuccess(res, null, 'If an account exists, a new code has been sent.');
  }

  if (user.emailVerified) {
    return sendSuccess(res, null, 'Email is already verified.');
  }

  const { otp } = await authService.createEmailVerificationToken(email);

  await novuService.initSubscriber({
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
  });

  novuService.trigger('email-verification', user.id, {
    name: user.name || 'there',
    otp,
  });

  return sendSuccess(res, null, 'If an account exists, a new code has been sent.');
});

/**
 * @route GET /api/auth/google
 * @desc Initiate Google OAuth
 * @access Public
 * (This is handled by Passport middleware, but we define it for documentation)
 */
export const googleAuth = (req, res, next) => {
  // Passport handles this
  next();
};

/**
 * @route GET /api/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
export const googleCallback = asyncHandler(async (req, res) => {
  // User and tokens are attached by Passport
  const user = req.user;

  if (!user || !user.tokens) {
    // Authentication failed, redirect to frontend with error
    return res.redirect(`${config.frontendUrl}/auth/callback?error=authentication_failed`);
  }

  // Set auth cookies
  setAuthCookies(res, user.tokens);

  // Redirect to frontend
  const redirectUrl = user.isNewUser
    ? `${config.frontendUrl}/onboarding`
    : `${config.frontendUrl}/dashboard`;

  return res.redirect(redirectUrl);
});

/**
 * @route GET /api/auth/me
 * @desc Get current authenticated user
 * @access Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    user: req.user,
  }, 'User retrieved successfully');
});

export default {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyEmailOTP,
  resendVerification,
  googleAuth,
  googleCallback,
  getCurrentUser,
};
