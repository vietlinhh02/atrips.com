/**
 * JWT Token Utilities
 * Handles token generation, verification, and cookie management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/index.js';
import { AppError } from '../errors/AppError.js';

// Token type constants
export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
};

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., '15m', '7d', '30d')
 * @returns {number} - Duration in milliseconds
 */
function parseDuration(duration) {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, value, unit] = match;
  return parseInt(value, 10) * units[unit];
}

/**
 * Generate an access token
 * @param {object} payload - Token payload (user data)
 * @returns {string} - JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      type: TOKEN_TYPES.ACCESS,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
      issuer: 'atrips',
      audience: 'atrips-client',
    }
  );
}

/**
 * Generate a refresh token
 * @param {object} payload - Token payload (user data)
 * @returns {string} - JWT refresh token
 */
export function generateRefreshToken(payload) {
  // Add a unique token ID for rotation tracking
  const tokenId = crypto.randomUUID();

  return jwt.sign(
    {
      ...payload,
      type: TOKEN_TYPES.REFRESH,
      tokenId,
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: 'atrips',
      audience: 'atrips-client',
    }
  );
}

/**
 * Generate both access and refresh tokens
 * @param {object} user - User object
 * @returns {object} - Object containing both tokens
 */
export function generateTokenPair(user) {
  const payload = {
    userId: user.id,
    email: user.email,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Verify an access token
 * @param {string} token - JWT access token
 * @returns {object} - Decoded token payload
 * @throws {AppError} - If token is invalid or expired
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'atrips',
      audience: 'atrips-client',
    });

    if (decoded.type !== TOKEN_TYPES.ACCESS) {
      throw AppError.invalidToken();
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'TokenExpiredError') {
      throw AppError.tokenExpired();
    }
    throw AppError.invalidToken();
  }
}

/**
 * Verify a refresh token
 * @param {string} token - JWT refresh token
 * @returns {object} - Decoded token payload
 * @throws {AppError} - If token is invalid or expired
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'atrips',
      audience: 'atrips-client',
    });

    if (decoded.type !== TOKEN_TYPES.REFRESH) {
      throw AppError.invalidToken();
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'TokenExpiredError') {
      throw AppError.tokenExpired();
    }
    throw AppError.invalidToken();
  }
}

/**
 * Set authentication cookies
 * @param {object} res - Express response object
 * @param {object} tokens - Object containing accessToken and refreshToken
 */
export function setAuthCookies(res, tokens) {
  const accessTokenMaxAge = parseDuration(config.jwt.expiresIn);
  const refreshTokenMaxAge = parseDuration(config.jwt.refreshExpiresIn);

  // Access token cookie
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: accessTokenMaxAge,
    path: '/',
    ...(config.cookie.domain && { domain: config.cookie.domain }),
  });

  // Refresh token cookie
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: refreshTokenMaxAge,
    path: '/api/auth/refresh', // Only sent to refresh endpoint
    ...(config.cookie.domain && { domain: config.cookie.domain }),
  });
}

/**
 * Clear authentication cookies
 * @param {object} res - Express response object
 */
export function clearAuthCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    ...(config.cookie.domain && { domain: config.cookie.domain }),
  };

  res.clearCookie('access_token', { ...cookieOptions, path: '/' });
  res.clearCookie('refresh_token', { ...cookieOptions, path: '/api/auth/refresh' });
}

/**
 * Extract token from request
 * Checks cookies first, then Authorization header
 * @param {object} req - Express request object
 * @param {string} tokenType - 'access' or 'refresh'
 * @returns {string|null} - Token or null if not found
 */
export function extractToken(req, tokenType = TOKEN_TYPES.ACCESS) {
  // Check cookies first
  if (tokenType === TOKEN_TYPES.ACCESS && req.cookies?.access_token) {
    return req.cookies.access_token;
  }

  if (tokenType === TOKEN_TYPES.REFRESH && req.cookies?.refresh_token) {
    return req.cookies.refresh_token;
  }

  // Fallback to Authorization header for access token
  if (tokenType === TOKEN_TYPES.ACCESS) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
  }

  return null;
}

/**
 * Generate a random token for email verification or password reset
 * @returns {string} - Random token
 */
export function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a short OTP code
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - OTP code
 */
export function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export default {
  TOKEN_TYPES,
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
};
