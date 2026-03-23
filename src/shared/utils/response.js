/**
 * Standardized API Response Utilities
 * Ensures consistent JSON response format across all endpoints
 */

/**
 * Send a success response
 * @param {object} res - Express response object
 * @param {object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  const response = {
    success: true,
    message,
    ...(data && { data }),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 * @param {object} res - Express response object
 * @param {object} data - Created resource data
 * @param {string} message - Success message
 */
export function sendCreated(res, data = null, message = 'Resource created successfully') {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a no content response (204)
 * @param {object} res - Express response object
 */
export function sendNoContent(res) {
  return res.status(204).send();
}

/**
 * Send an error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {object} details - Additional error details
 */
export function sendError(res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 * @param {object} res - Express response object
 * @param {Array} items - Array of items
 * @param {object} pagination - Pagination info
 * @param {string} message - Success message
 */
export function sendPaginated(res, items, pagination, message = 'Success') {
  const response = {
    success: true,
    message,
    data: items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json(response);
}

/**
 * Send validation error response
 * @param {object} res - Express response object
 * @param {Array} errors - Validation errors
 */
export function sendValidationError(res, errors) {
  return sendError(
    res,
    'Validation failed',
    422,
    'VALIDATION_ERROR',
    { errors }
  );
}

export default {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendError,
  sendPaginated,
  sendValidationError,
};
