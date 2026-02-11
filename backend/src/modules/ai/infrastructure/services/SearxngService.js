/**
 * SearXNG Service
 * Wrapper for SearXNG metasearch engine with retry & circuit breaker
 */

import axios from 'axios';
import cacheService from '../../../../shared/services/CacheService.js';

const SEARXNG_CACHE_TTL = 1800;  // 30 minutes
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const CIRCUIT_OPEN_MS = 30000;   // 30s circuit break on repeated failures
const CONSECUTIVE_FAIL_THRESHOLD = 3;

class SearxngService {
  constructor(baseUrl = process.env.SEARXNG_URL || 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 12000,
      headers: { Accept: 'application/json' },
    });

    // Circuit breaker state
    this._consecutiveFailures = 0;
    this._circuitOpenUntil = 0;
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Core search method with retry + circuit breaker
   */
  async search(options) {
    const {
      query,
      language = 'vi',
      limit = 10,
      category = 'general',
      engines = [],
      timeRange = '',
    } = options;

    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    // Circuit breaker check
    if (this._isCircuitOpen()) {
      console.warn('[SearXNG] Circuit breaker OPEN - returning empty');
      return this._emptyResult(query);
    }

    const cacheKey = `searxng:${query}:${language}:${category}:${limit}:${timeRange}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      language,
      categories: category,
    });
    if (engines.length > 0) params.set('engines', engines.join(','));
    if (timeRange) params.set('time_range', timeRange);

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(RETRY_DELAY_MS * attempt);
          console.log(`[SearXNG] Retry ${attempt}/${MAX_RETRIES}: "${query}"`);
        } else {
          console.log(`[SearXNG] Search: "${query}" (lang: ${language}, limit: ${limit})`);
        }

        const response = await this.client.get(`/search?${params.toString()}`);

        if (!response.data || !response.data.results) {
          throw new Error('Invalid response from SearXNG');
        }

        this._consecutiveFailures = 0; // reset on success

        const formatted = this._formatResults(response.data, limit);
        await cacheService.set(cacheKey, formatted, SEARXNG_CACHE_TTL);
        return formatted;
      } catch (error) {
        lastError = error;
      }
    }

    // All retries failed
    this._consecutiveFailures++;
    if (this._consecutiveFailures >= CONSECUTIVE_FAIL_THRESHOLD) {
      this._circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      console.error(`[SearXNG] Circuit breaker OPENED for ${CIRCUIT_OPEN_MS / 1000}s`);
    }

    console.error('SearXNG search failed after retries:', lastError.message);
    throw new Error(`SearXNG search failed: ${lastError.message}`);
  }

  /**
   * Enhanced search — auto-adds current year
   */
  async enhancedSearch(query, options = {}) {
    return this.search({
      query: enhanceQueryWithYear(query),
      ...options,
    });
  }

  /**
   * Domain-scoped search using `site:` operator
   */
  async domainSearch(query, domains = [], options = {}) {
    const domainQuery = domains.length > 0
      ? `${query} (${domains.map(d => `site:${d}`).join(' OR ')})`
      : query;

    return this.search({ query: domainQuery, ...options });
  }

  /**
   * Travel-specific search with Vietnam-optimized domains
   */
  async travelSearch(query, type = 'general') {
    const domainMap = {
      flights: [
        'traveloka.com', 'google.com/travel/flights', 'skyscanner.com',
        'vietjetair.com', 'vietnamairlines.com', 'bambooairways.com',
      ],
      hotels: [
        'booking.com', 'agoda.com', 'hotels.com',
        'airbnb.com', 'tripadvisor.com', 'traveloka.com',
      ],
      events: [
        'facebook.com/events', 'eventbrite.com',
        'ticketbox.vn', 'thiso.io',
      ],
    };

    const domains = domainMap[type] || [];
    return this.domainSearch(enhanceQueryWithYear(query), domains, {
      limit: 10,
      language: 'vi',
    });
  }

  /**
   * Health check — lightweight HEAD / GET
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/', { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  _isCircuitOpen() {
    if (Date.now() < this._circuitOpenUntil) return true;
    // Auto-close after timeout (half-open → try again)
    if (this._circuitOpenUntil > 0) {
      this._circuitOpenUntil = 0;
      this._consecutiveFailures = 0;
    }
    return false;
  }

  _formatResults(data, limit) {
    const seen = new Set();
    const results = [];

    for (const r of data.results || []) {
      if (results.length >= limit) break;
      if (seen.has(r.url)) continue;
      seen.add(r.url);

      results.push({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        publishedDate: r.publishedDate || null,
        author: r.author || null,
        score: r.score || 0,
        engine: r.engine || 'unknown',
        engines: r.engines || [],
        category: r.category || 'general',
        thumbnail: r.thumbnail || null,
      });
    }

    return {
      source: 'searxng',
      query: data.query || '',
      results,
      totalResults: results.length,
      engines: [...new Set(results.flatMap(r => r.engines))],
      suggestions: data.suggestions || [],
      corrections: data.corrections || [],
      answers: data.answers || [],
    };
  }

  _emptyResult(query) {
    return {
      source: 'searxng',
      query,
      results: [],
      totalResults: 0,
      engines: [],
      suggestions: [],
      corrections: [],
      answers: [],
    };
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────

function enhanceQueryWithYear(query) {
  const year = new Date().getFullYear();
  if (/\b(202\d|203\d)\b/.test(query)) return query;
  return `${query} ${year}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default new SearxngService();
