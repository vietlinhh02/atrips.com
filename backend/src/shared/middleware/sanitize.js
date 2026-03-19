/**
 * Input sanitization middleware for chat messages.
 * Strips HTML tags, enforces length limits, and validates
 * that a non-empty message remains after sanitization.
 */

const MAX_MESSAGE_LENGTH = 5000;

/**
 * Strip HTML tags from string.
 * @param {string} str
 * @returns {string}
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Limit string length.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = MAX_MESSAGE_LENGTH) {
  if (typeof str !== 'string') return str;
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Sanitize a single chat message string.
 * Returns empty string for non-string / falsy input.
 * @param {string} message
 * @returns {string}
 */
export function sanitizeChatInput(message) {
  if (!message || typeof message !== 'string') return '';
  return truncate(stripHtml(message), MAX_MESSAGE_LENGTH);
}

/**
 * Express middleware that sanitizes the `message` field
 * on both req.body (POST) and req.query (GET/SSE).
 * Returns 400 if the message becomes empty after sanitization.
 */
export function sanitizeChatMiddleware(req, res, next) {
  if (req.body?.message) {
    req.body.message = sanitizeChatInput(req.body.message);
    if (!req.body.message) {
      return res.status(400).json({ error: 'Message is required' });
    }
  }
  if (req.query?.message) {
    req.query.message = sanitizeChatInput(req.query.message);
    if (!req.query.message) {
      return res.status(400).json({ error: 'Message is required' });
    }
  }
  next();
}
