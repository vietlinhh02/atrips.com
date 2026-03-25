/**
 * Custom Application Error Class
 * Provides consistent error handling across the application
 */

export class AppError extends Error {
  /**
   * Create an AppError
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Application-specific error code
   * @param {object} details - Additional error details
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
      },
      timestamp: this.timestamp,
    };
  }

  // Common error factory methods

  static badRequest(message = 'Bad request', details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Resource already exists', details = null) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static unprocessableEntity(message = 'Unprocessable entity', details = null) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  // Auth-specific errors

  static invalidCredentials() {
    return new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  static emailAlreadyExists() {
    return new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  static emailNotVerified() {
    return new AppError('Please verify your email address', 403, 'EMAIL_NOT_VERIFIED');
  }

  static tokenExpired() {
    return new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
  }

  static invalidToken() {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  static accountDisabled() {
    return new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
  }

  // Subscription-specific errors

  static subscriptionRequired(requiredTier) {
    return new AppError(
      `This feature requires a ${requiredTier} subscription`,
      403,
      'SUBSCRIPTION_REQUIRED',
      { requiredTier }
    );
  }

  static quotaExceeded(resource) {
    return new AppError(
      `You have exceeded your ${resource} quota`,
      403,
      'QUOTA_EXCEEDED',
      { resource }
    );
  }

  static conversationLimitExceeded(limitType, used, limit, summary = null) {
    return new AppError(
      `Conversation ${limitType} limit reached (${used}/${limit})`,
      429,
      'CONVERSATION_LIMIT',
      { limitType, used, limit, summary }
    );
  }
}

export default AppError;
