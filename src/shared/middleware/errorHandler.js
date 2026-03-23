/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */

import { AppError } from '../errors/AppError.js';
import config from '../../config/index.js';

/**
 * Not Found Handler
 * Catches requests to undefined routes
 */
export function notFoundHandler(req, res, next) {
  const error = AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
}

/**
 * Global Error Handler
 * Processes all errors and returns appropriate responses
 */
export function errorHandler(err, req, res, next) {
  // Default error properties
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Log error
  if (statusCode >= 500) {
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user?.id,
    });
  } else if (config.nodeEnv === 'development') {
    console.log('Client Error:', {
      statusCode,
      code,
      message,
      path: req.path,
      method: req.method,
    });
  }

  // Handle specific error types

  // Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'A record with this value already exists';
    const target = err.meta?.target;
    if (target) {
      details = { field: Array.isArray(target) ? target.join(', ') : target };
    }
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Record not found';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Validation errors (express-validator)
  if (err.array && typeof err.array === 'function') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = { errors: err.array() };
  }

  // Syntax errors (JSON parsing)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Invalid JSON in request body';
  }

  // Check if response headers already sent
  if (res.headersSent) {
    // If headers already sent, delegate to default Express error handler
    return next(err);
  }

  // Build response
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(config.nodeEnv === 'development' && statusCode >= 500 && {
        stack: err.stack,
      }),
    },
    timestamp: new Date().toISOString(),
  };

  // Send response
  res.status(statusCode).json(response);
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler,
};
