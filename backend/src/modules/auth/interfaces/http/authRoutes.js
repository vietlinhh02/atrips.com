/**
 * Auth Routes
 * Defines routes for authentication endpoints
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import passport from 'passport';
import authController from './authController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

/**
 * Validation rules
 */
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less')
    .trim(),
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32 })
    .withMessage('Invalid reset token'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
];

const verifyEmailValidation = [
  param('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 32 })
    .withMessage('Invalid verification token'),
];

const verifyEmailOTPValidation = [
  body('otp')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const resendVerificationValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/**
 * Routes
 */

// Email/Password Authentication
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

// Password Reset
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// Email Verification
router.get('/verify-email/:token', verifyEmailValidation, authController.verifyEmail);
router.post('/verify-email', verifyEmailOTPValidation, authController.verifyEmailOTP);
router.post('/resend-verification', resendVerificationValidation, authController.resendVerification);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/auth/login?error=google_auth_failed',
  }),
  authController.googleCallback
);

// Get current user (requires authentication)
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
