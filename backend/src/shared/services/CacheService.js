/**
 * Cache Service
 * Redis-based caching with fallback to in-memory cache
 */

import { createClient } from 'redis';
import { logger } from './LoggerService.js';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryCache = new Map();
    this.memoryCacheTTL = new Map();
    this.memoryAccessTime = new Map();
    this.initialized = false;
    this.MAX_MEMORY_ENTRIES = 500;

    this.cleanupInterval = setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    if (this.initialized) return;

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.info('[Cache] REDIS_URL not set, using in-memory cache');
      this.initialized = true;
      return;
    }

    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        logger.error('[Cache] Redis Client Error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('[Cache] Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.info('[Cache] Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.initialized = true;
    } catch (error) {
      logger.error('[Cache] Failed to connect to Redis', { error: error.message });
      logger.info('[Cache] Falling back to in-memory cache');
      this.initialized = true;
    }
  }

  /**
   * Generate cache key for AI chat
   */
  generateChatKey(messages, options = {}) {
    const messagesHash = this.hashString(JSON.stringify(messages));
    const optionsHash = this.hashString(JSON.stringify({
      model: options.model,
      temperature: options.temperature,
    }));
    return `ai:chat:${messagesHash}:${optionsHash}`;
  }

  /**
   * Simple string hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      if (this.isConnected && this.client) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      }

      // Fallback to memory cache
      const ttl = this.memoryCacheTTL.get(key);
      if (ttl && Date.now() > ttl) {
        this.memoryCache.delete(key);
        this.memoryCacheTTL.delete(key);
        this.memoryAccessTime.delete(key);
        return null;
      }
      const cached = this.memoryCache.get(key);
      if (cached !== undefined) {
        this.memoryAccessTime.set(key, Date.now());
        return cached;
      }
      return null;
    } catch (error) {
      logger.error('[Cache] Get error', { error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - TTL in seconds (default: 1 hour)
   */
  async set(key, value, ttlSeconds = 3600) {
    try {
      const serialized = JSON.stringify(value);

      if (this.isConnected && this.client) {
        await this.client.setEx(key, ttlSeconds, serialized);
        return true;
      }

      // Fallback to memory cache
      this.memoryCache.set(key, value);
      this.memoryCacheTTL.set(key, Date.now() + (ttlSeconds * 1000));
      this.memoryAccessTime.set(key, Date.now());

      if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
        this.cleanupMemoryCache();
      }

      return true;
    } catch (error) {
      logger.error('[Cache] Set error', { error: error.message });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
        return true;
      }

      this.memoryCache.delete(key);
      this.memoryCacheTTL.delete(key);
      this.memoryAccessTime.delete(key);
      return true;
    } catch (error) {
      logger.error('[Cache] Delete error', { error: error.message });
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   * Supports wildcards: * matches any characters
   */
  async delPattern(pattern) {
    try {
      if (this.isConnected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
        return { deleted: keys.length };
      }

      // Fallback: clear matching keys from memory cache
      let deletedCount = 0;
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          this.memoryCacheTTL.delete(key);
          this.memoryAccessTime.delete(key);
          deletedCount++;
        }
      }

      return { deleted: deletedCount };
    } catch (error) {
      logger.error('[Cache] DelPattern error', { error: error.message });
      return { deleted: 0, error: error.message };
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.exists(key) === 1;
      }

      const ttl = this.memoryCacheTTL.get(key);
      if (ttl && Date.now() > ttl) {
        this.memoryCache.delete(key);
        this.memoryCacheTTL.delete(key);
        this.memoryAccessTime.delete(key);
        return false;
      }
      const has = this.memoryCache.has(key);
      if (has) {
        this.memoryAccessTime.set(key, Date.now());
      }
      return has;
    } catch (error) {
      logger.error('[Cache] Exists error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (this.isConnected && this.client) {
        const info = await this.client.info('stats');
        return {
          type: 'redis',
          connected: true,
          info,
        };
      }

      return {
        type: 'memory',
        connected: false,
        size: this.memoryCache.size,
      };
    } catch (error) {
      return {
        type: 'unknown',
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Cleanup expired entries and apply LRU eviction
   * when entries exceed MAX_MEMORY_ENTRIES.
   */
  cleanupMemoryCache() {
    const now = Date.now();
    const sizeBefore = this.memoryCache.size;
    let expiredCount = 0;

    for (const [key, ttl] of this.memoryCacheTTL.entries()) {
      if (now > ttl) {
        this.memoryCache.delete(key);
        this.memoryCacheTTL.delete(key);
        this.memoryAccessTime.delete(key);
        expiredCount++;
      }
    }

    let evictedCount = 0;
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      const entries = [...this.memoryAccessTime.entries()]
        .sort((a, b) => a[1] - b[1]);
      const toEvict = Math.ceil(entries.length * 0.25);
      for (let i = 0; i < toEvict; i++) {
        this.memoryCache.delete(entries[i][0]);
        this.memoryCacheTTL.delete(entries[i][0]);
        this.memoryAccessTime.delete(entries[i][0]);
        evictedCount++;
      }
    }

    if (expiredCount > 0 || evictedCount > 0) {
      logger.info('[Cache] Cleanup', { expired: expiredCount, evicted: evictedCount, before: sizeBefore, after: this.memoryCache.size });
    }
  }

  /**
   * Return in-memory cache stats.
   */
  getMemoryStats() {
    return {
      entries: this.memoryCache.size,
      maxEntries: this.MAX_MEMORY_ENTRIES,
    };
  }

  /**
   * Close Redis connection
   */
  async close() {
    clearInterval(this.cleanupInterval);
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
