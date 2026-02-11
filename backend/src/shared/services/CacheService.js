/**
 * Cache Service
 * Redis-based caching with fallback to in-memory cache
 */

import { createClient } from 'redis';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryCache = new Map();
    this.memoryCacheTTL = new Map();
    this.initialized = false;
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    if (this.initialized) return;

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('REDIS_URL not set, using in-memory cache');
      this.initialized = true;
      return;
    }

    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      console.log('Falling back to in-memory cache');
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
        return null;
      }
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Cache get error:', error.message);
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

      // Clean up old entries periodically
      if (this.memoryCache.size > 1000) {
        this.cleanupMemoryCache();
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error.message);
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
      return true;
    } catch (error) {
      console.error('Cache delete error:', error.message);
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
          deletedCount++;
        }
      }

      return { deleted: deletedCount };
    } catch (error) {
      console.error('Cache delPattern error:', error.message);
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
        return false;
      }
      return this.memoryCache.has(key);
    } catch (error) {
      console.error('Cache exists error:', error.message);
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
   * Cleanup expired entries from memory cache
   */
  cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, ttl] of this.memoryCacheTTL.entries()) {
      if (now > ttl) {
        this.memoryCache.delete(key);
        this.memoryCacheTTL.delete(key);
      }
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
