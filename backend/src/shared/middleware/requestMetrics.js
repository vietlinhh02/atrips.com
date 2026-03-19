import { randomUUID } from 'node:crypto';
import { logger } from '../services/LoggerService.js';

/**
 * Attach a correlation ID to every request and log timing
 * for non-trivial responses.
 *
 * Headers set:
 *   X-Request-Id    -- propagated from caller or generated
 *   X-Response-Time -- wall-clock ms (set before headers flush)
 */
export function requestMetrics(req, res, next) {
  const requestId =
    req.headers['x-request-id'] || randomUUID();
  const start = performance.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Inject X-Response-Time right before headers are flushed
  // so the value is available to the client.
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function patchedWriteHead(...args) {
    const duration = Math.round(performance.now() - start);
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalWriteHead(...args);
  };

  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);

    if (req.path === '/health' || req.path === '/ready') {
      return;
    }

    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    };

    if (duration > 300) {
      logger.warn('[SlowRequest]', logData);
    } else if (duration > 100) {
      logger.info('[Request]', logData);
    }
  });

  next();
}
