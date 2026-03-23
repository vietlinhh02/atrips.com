/**
 * Simple Rate Limiter for API calls
 * Implements token bucket algorithm
 */

export class RateLimiter {
  constructor(maxRequests, intervalMs) {
    this.maxRequests = maxRequests;
    this.intervalMs = intervalMs;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.intervalMs) * this.maxRequests;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquire() {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        this.refillTokens();

        if (this.tokens > 0) {
          this.tokens--;
          resolve();
        } else {
          // Wait and retry
          setTimeout(tryAcquire, this.intervalMs / this.maxRequests);
        }
      };

      tryAcquire();
    });
  }
}

export default RateLimiter;
