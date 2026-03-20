/**
 * Serper.dev Service
 * Google Search API — structured results, no rate limits.
 * Primary search provider, replaces SearXNG for web search.
 */

import cacheService from '../../../../shared/services/CacheService.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const SERPER_BASE_URL = 'https://google.serper.dev';
const CACHE_TTL = 1800; // 30 minutes
const REQUEST_TIMEOUT_MS = 10000;

class SerperService {
  constructor() {
    this.apiKey = SERPER_API_KEY;
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Google web search via Serper.dev
   * @param {Object} options
   * @param {string} options.query
   * @param {number} [options.limit=10]
   * @param {string} [options.gl='vn'] - Country code
   * @param {string} [options.hl='vi'] - Language
   * @returns {Promise<{results: Array, knowledgeGraph?: Object, peopleAlsoAsk?: Array}>}
   */
  async search(options) {
    const {
      query,
      limit = 10,
      gl = 'vn',
      hl = 'vi',
    } = options;

    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY not configured');
    }

    const cacheKey = `serper:web:${query}:${gl}:${hl}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    const startMs = Date.now();

    try {
      const response = await fetch(`${SERPER_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          gl,
          hl,
          num: Math.min(limit, 20),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Serper API ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const elapsedMs = Date.now() - startMs;

      logger.info('[Serper] Search OK', {
        query: query.substring(0, 50),
        organic: data.organic?.length || 0,
        elapsedMs,
      });

      const result = this._normalizeResults(data, query);
      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('[Serper] Search failed', {
        query: query.substring(0, 50),
        error: error.message,
        elapsedMs: Date.now() - startMs,
      });
      throw error;
    }
  }

  /**
   * Google Places search via Serper.dev
   */
  async searchPlaces(options) {
    const {
      query,
      gl = 'vn',
      hl = 'vi',
    } = options;

    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY not configured');
    }

    const cacheKey = `serper:places:${query}:${gl}:${hl}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    const startMs = Date.now();

    try {
      const response = await fetch(`${SERPER_BASE_URL}/places`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl, hl }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Serper Places ${response.status}`);
      }

      const data = await response.json();
      const elapsedMs = Date.now() - startMs;

      logger.info('[Serper] Places OK', {
        query: query.substring(0, 50),
        places: data.places?.length || 0,
        elapsedMs,
      });

      const result = {
        source: 'serper-places',
        query,
        places: (data.places || []).map(p => ({
          name: p.title || p.name,
          address: p.address || '',
          latitude: p.latitude || null,
          longitude: p.longitude || null,
          rating: p.rating || null,
          ratingCount: p.ratingCount || null,
          category: p.category || '',
          phone: p.phoneNumber || null,
          website: p.website || null,
          cid: p.cid || null,
        })),
      };

      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('[Serper] Places failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search hotels via Google (Serper web search + places).
   */
  async searchHotels(options) {
    const { destination, checkin, checkout, guests, budget } = options;

    const budgetHint = budget === 'luxury' ? 'luxury 5 star'
      : budget === 'budget' ? 'budget cheap'
      : 'best rated';

    const query = `${budgetHint} hotels ${destination} ${checkin || ''} ${guests || 2} guests`.trim();

    const [webResults, placesResults] = await Promise.allSettled([
      this.search({ query, limit: 5 }),
      this.searchPlaces({ query: `hotels ${destination}` }),
    ]);

    const hotels = [];
    const seenNames = new Set();

    // Places → structured hotel data
    if (placesResults.status === 'fulfilled' && placesResults.value?.places) {
      for (const p of placesResults.value.places) {
        const key = (p.name || '').toLowerCase();
        if (key && !seenNames.has(key)) {
          seenNames.add(key);
          hotels.push({
            name: p.name,
            address: p.address,
            rating: p.rating,
            ratingCount: p.ratingCount,
            latitude: p.latitude,
            longitude: p.longitude,
            category: p.category,
            phone: p.phone,
            website: p.website,
            source: 'google-places',
          });
        }
      }
    }

    // Web → contextual info (prices, booking links)
    const webContext = [];
    if (webResults.status === 'fulfilled' && webResults.value?.results) {
      for (const r of webResults.value.results) {
        webContext.push({
          title: r.title,
          url: r.url,
          snippet: r.content,
        });
      }
    }

    return { hotels, webContext, source: 'serper' };
  }

  /**
   * Search flights via Google (Serper web search).
   */
  async searchFlights(options) {
    const { origin, destination, departureDate, returnDate, passengers } = options;

    const query = `flights ${origin || ''} to ${destination} ${departureDate || ''} ${returnDate ? 'return ' + returnDate : ''} ${passengers || 1} passengers`.trim();

    const result = await this.search({ query, limit: 8, hl: 'en' });

    return {
      source: 'serper',
      query,
      results: result.results || [],
      knowledgeGraph: result.knowledgeGraph,
    };
  }

  /**
   * Search images via Google (Serper).
   */
  async searchImages(options) {
    const { query, limit = 5 } = options;

    if (!this.apiKey) return null;

    const cacheKey = `serper:images:${query}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${SERPER_BASE_URL}/images`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: limit }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const images = (data.images || []).slice(0, limit).map(img => ({
        title: img.title || '',
        url: img.imageUrl || '',
        source: img.link || '',
        width: img.imageWidth,
        height: img.imageHeight,
      }));

      const result = { images, source: 'serper-images' };
      await cacheService.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Normalize Serper web search response to match existing format.
   */
  _normalizeResults(data, query) {
    const results = (data.organic || []).map(item => ({
      title: item.title || '',
      url: item.link || '',
      content: item.snippet || '',
      position: item.position,
      date: item.date || null,
      sitelinks: item.sitelinks || [],
      attributes: item.attributes || null,
      engine: 'google-serper',
    }));

    return {
      source: 'serper',
      query,
      results,
      totalResults: results.length,
      knowledgeGraph: data.knowledgeGraph || null,
      peopleAlsoAsk: data.peopleAlsoAsk || null,
      relatedSearches: data.relatedSearches || null,
    };
  }
}

export default new SerperService();
