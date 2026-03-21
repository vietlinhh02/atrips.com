/**
 * Tool Guardrails
 * Input sanitization, per-tool caching, rate limiting, and model output simplification.
 * Adapted from reference implementation's tool-factory guardrails pattern.
 */

import { TOOL_ERROR_CODES } from './toolErrors.js';

// ─────────────────────────────────────────────────
// 1. Input Sanitization (prototype pollution prevention)
// ─────────────────────────────────────────────────

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep-sanitize tool input to prevent prototype pollution.
 * Strips dangerous keys and handles circular references.
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
export function sanitizeToolInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return typeof input === 'object' && input !== null ? {} : {};
  }

  const visited = new WeakSet();

  function sanitizeValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (visited.has(value)) return undefined; // circular ref
    visited.add(value);

    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item)).filter(v => v !== undefined);
    }

    const sanitized = Object.create(null);
    for (const [key, nested] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      const clean = sanitizeValue(nested);
      if (clean !== undefined) sanitized[key] = clean;
    }
    return sanitized;
  }

  return sanitizeValue(input);
}

// ─────────────────────────────────────────────────
// 2. In-Memory Tool Cache
// ─────────────────────────────────────────────────

export class ToolCache {
  constructor() {
    /** @type {Map<string, { value: unknown, expiresAt: number }>} */
    this._store = new Map();
    this._maxSize = 500;
    // Periodic cleanup every 60s
    this._cleanupInterval = setInterval(() => this._cleanup(), 60_000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * @param {string} toolName
   * @param {string} keySuffix
   * @returns {string}
   */
  _buildKey(toolName, keySuffix) {
    return `tool:${toolName}:${keySuffix}`;
  }

  /**
   * Get cached result.
   * @param {string} toolName
   * @param {string} keySuffix
   * @returns {unknown|null}
   */
  get(toolName, keySuffix) {
    const key = this._buildKey(toolName, keySuffix);
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set cached result with TTL.
   * @param {string} toolName
   * @param {string} keySuffix
   * @param {unknown} value
   * @param {number} ttlSeconds
   */
  set(toolName, keySuffix, value, ttlSeconds) {
    if (!ttlSeconds || ttlSeconds <= 0) return;
    // Evict oldest if at capacity
    if (this._store.size >= this._maxSize) {
      const oldestKey = this._store.keys().next().value;
      if (oldestKey) this._store.delete(oldestKey);
    }
    const key = this._buildKey(toolName, keySuffix);
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(key);
    }
  }

  get size() {
    return this._store.size;
  }
}

// ─────────────────────────────────────────────────
// 3. Sliding Window Rate Limiter
// ─────────────────────────────────────────────────

export class SlidingWindowLimiter {
  constructor() {
    /** @type {Map<string, number[]>} */
    this._windows = new Map();
    // Cleanup every 30s
    this._cleanupInterval = setInterval(() => this._cleanup(), 30_000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * Check if request is within rate limit.
   * @param {string} toolName
   * @param {string} identifier - userId or IP
   * @param {number} limit - Max requests per window
   * @param {number} windowMs - Window size in milliseconds
   * @returns {boolean} true if allowed, false if rate limited
   */
  check(toolName, identifier, limit, windowMs) {
    const key = `${toolName}:${identifier}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = this._windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this._windows.set(key, timestamps);
    }

    // Remove expired timestamps
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= limit) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this._windows) {
      // Remove windows with no recent activity (older than 5 minutes)
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - 300_000) {
        this._windows.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────
// 4. Per-tool toModelOutput Simplifiers
// ─────────────────────────────────────────────────

/**
 * Functions that simplify tool results before sending to the model.
 * The full result is still returned to the caller (controller).
 * Key insight from reference: reduces token usage by 50-80% for large results.
 */
export const MODEL_OUTPUT_SIMPLIFIERS = {
  web_search: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 8).map(r => {
        // Gemini grounding uses 'content', SearXNG uses 'snippet' or 'content'
        const text = r.snippet || r.content || '';
        return {
          title: r.title,
          url: r.url,
          ...(text ? { snippet: text.substring(0, 500) } : {}),
        };
      }),
    };
  },

  scrape_url: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      title: data.title,
      url: data.url,
      // Truncate content to 3000 chars for model
      content: typeof data.content === 'string'
        ? data.content.substring(0, 3000)
        : data.content,
    };
  },

  search_places: (result) => {
    // If the tool explicitly failed or fell back, pass the failure info directly to the model
    if (!result?.success || result?.data?.success === false) {
      return result?.data || result;
    }
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.places?.length || data.results?.length || 0,
      places: (data.places || data.results || []).slice(0, 8).map(p => ({
        name: p.name,
        address: p.address || p.formatted_address,
        rating: p.rating,
        ratingCount: p.ratingCount || p.user_ratings_total,
        type: p.type || p.category,
        priceLevel: p.priceLevel || p.price_level,
      })),
    };
  },

  optimize_itinerary: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    const itinerary = data.itinerary || {};
    const itineraryDays = Array.isArray(itinerary.days)
      ? itinerary.days
      : (Array.isArray(data.days) ? data.days : []);
    return {
      success: true,
      days: itineraryDays.map(day => ({
        dayNumber: day.dayNumber,
        date: day.date,
        placesCount: day.places?.length || 0,
        places: (day.places || []).map(p => ({
          name: p.name,
          type: p.type,
          rating: p.rating,
          address: p.address,
          estimatedDuration: p.estimatedDuration,
        })),
        totalDistance: day.totalDistance,
      })),
      totalPlaces: itinerary.summary?.totalPlaces || data.placesUsed || 0,
      // Include Google Maps data summary but not full raw texts
      hasGoogleMapsData: !!data.googleMapsData,
      googleMapsPlaceCount: data.googleMapsData
        ? Object.keys(data.googleMapsData).length
        : 0,
    };
  },

  search_flights: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    // SearXNG handler returns searchResults, Amadeus returns flights/results
    const rawFlights = data.flights || data.results || data.searchResults || [];
    if (data.searchResults) {
      // SearXNG web search results — pass through as search results for AI to interpret
      return {
        success: true,
        source: data.source || 'web_search',
        resultCount: rawFlights.length,
        results: rawFlights.slice(0, 5).map(f => ({
          title: f.title,
          url: f.url,
          snippet: f.snippet || f.content || '',
          site: f.site,
          prices: f.prices || [],
        })),
        bookingLinks: data.bookingLinks || [],
        note: data.note || '',
      };
    }
    return {
      success: true,
      resultCount: rawFlights.length,
      flights: rawFlights.slice(0, 5).map(f => ({
        airline: f.airline,
        price: f.price,
        currency: f.currency,
        departure: f.departure || f.departureTime,
        arrival: f.arrival || f.arrivalTime,
        duration: f.duration,
        stops: f.stops,
      })),
    };
  },

  search_hotels: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.hotels?.length || data.results?.length || 0,
      hotels: (data.hotels || data.results || []).slice(0, 5).map(h => ({
        name: h.name,
        rating: h.rating,
        price: h.price,
        currency: h.currency,
        address: h.address,
        amenities: (h.amenities || []).slice(0, 5),
      })),
    };
  },

  get_local_events: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.events?.length || 0,
      events: (data.events || []).slice(0, 5).map(e => ({
        name: e.name,
        date: e.date || e.startDate,
        venue: e.venue,
        category: e.category,
      })),
    };
  },

  search_social_media: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
        platform: r.platform,
        ...(r.viewCount ? { viewCount: r.viewCount } : {}),
      })),
    };
  },

  search_youtube_videos: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      resultCount: data.videos?.length || 0,
      videos: (data.videos || []).slice(0, 5).map(v => ({
        title: v.title,
        url: v.url,
        channelTitle: v.channelTitle,
        viewCount: v.viewCount,
        duration: v.duration,
        publishedAt: v.publishedAt,
      })),
    };
  },

  get_user_trips: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      tripCount: data.trips?.length || 0,
      trips: (data.trips || []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
        destination: t.destination,
      })),
    };
  },

  get_trip_detail: (result) => {
    if (!result?.success || result?.data?.success === false) return result?.data || result;
    const data = result.data || {};
    return {
      success: true,
      trip: {
        id: data.id,
        title: data.title,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        destination: data.destination,
        daysCount: data.days?.length || 0,
        days: (data.days || []).map(d => ({
          id: d.id,
          dayNumber: d.dayNumber,
          date: d.date,
          title: d.title,
          activitiesCount: d.activities?.length || 0,
          activities: (d.activities || []).map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            startTime: a.startTime,
          })),
        })),
      },
    };
  },
};

// ─────────────────────────────────────────────────
// 5. Per-tool Cache Configuration
// ─────────────────────────────────────────────────

/**
 * Infer TTL based on query content (like reference's inferTtlSeconds).
 */
function inferSearchTtl(query) {
  if (!query || typeof query !== 'string') return 3600;
  const q = query.toLowerCase();
  if (/(\bnow\b|today|right now|weather)/.test(q)) return 120;
  if (/(breaking|\bnews\b|update)/.test(q)) return 600;
  if (/(price|fare|flight|deal)/.test(q)) return 3600;
  if (/(menu|hours|schedule)/.test(q)) return 21600;
  return 3600;
}

/**
 * Build a stable cache key from args.
 */
function hashArgs(args) {
  const sorted = JSON.stringify(args, Object.keys(args).sort());
  // Simple FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < sorted.length; i++) {
    hash ^= sorted.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export const TOOL_CACHE_CONFIG = {
  web_search: {
    key: (args) => args.query ? `q:${hashArgs({ query: args.query.trim().toLowerCase(), type: args.type, numResults: args.numResults })}` : null,
    ttlSeconds: (args) => inferSearchTtl(args.query),
    shouldBypass: (args) => !!args.fresh,
  },
  search_places: {
    key: (args) => args.location ? `loc:${hashArgs({ query: args.query, location: args.location, type: args.type })}` : null,
    ttlSeconds: () => 7200, // 2 hours
  },
  get_weather: {
    key: (args) => args.location ? `w:${hashArgs({ location: args.location, date: args.date })}` : null,
    ttlSeconds: (args) => args.date ? 3600 : 300, // forecast: 1h, current: 5m
  },
  get_exchange_rate: {
    key: (args) => args.from_currency ? `fx:${hashArgs({ from: args.from_currency, to: args.to_currency })}` : null,
    ttlSeconds: () => 3600, // 1 hour
  },
  search_flights: {
    key: (args) => args.origin ? `fl:${hashArgs({ origin: args.origin, destination: args.destination, date: args.departure_date })}` : null,
    ttlSeconds: () => 1800, // 30 min
  },
  search_hotels: {
    key: (args) => args.location ? `ht:${hashArgs({ location: args.location, checkIn: args.check_in, checkOut: args.check_out })}` : null,
    ttlSeconds: () => 1800, // 30 min
  },
  get_local_events: {
    key: (args) => args.location ? `ev:${hashArgs({ location: args.location, dateFrom: args.date_from, dateTo: args.date_to })}` : null,
    ttlSeconds: () => 3600,
  },
  get_travel_tips: {
    key: (args) => args.destination ? `tips:${hashArgs({ destination: args.destination, topics: args.topics })}` : null,
    ttlSeconds: () => 86400, // 24 hours
  },
  search_social_media: {
    key: (args) => args.query ? `sm:${hashArgs({ query: args.query.trim().toLowerCase() })}` : null,
    ttlSeconds: () => 3600,
  },
  search_youtube_videos: {
    key: (args) => args.query ? `yt:${hashArgs({ query: args.query.trim().toLowerCase(), order: args.order })}` : null,
    ttlSeconds: () => 3600,
  },
  // No caching for: calculate_distance (cheap), get_current_datetime (must be fresh),
  // optimize_itinerary (unique per request), create_trip_plan (side effects),
  // trip management CRUD tools (side effects)
};

// ─────────────────────────────────────────────────
// 6. Per-tool Rate Limit Configuration
// ─────────────────────────────────────────────────

const MINUTE = 60_000;

export const TOOL_RATE_LIMITS = {
  web_search: { limit: 20, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.webSearchRateLimited },
  scrape_url: { limit: 10, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.scrapeUrlRateLimited },
  search_places: { limit: 15, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.searchPlacesRateLimited },
  search_flights: { limit: 10, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.flightSearchRateLimited },
  search_hotels: { limit: 10, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.hotelSearchRateLimited },
  optimize_itinerary: { limit: 5, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.optimizeItineraryRateLimited },
  create_trip_plan: { limit: 5, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.createTripPlanRateLimited },
  search_social_media: { limit: 15, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.socialMediaSearchRateLimited },
  search_youtube_videos: { limit: 15, windowMs: MINUTE, errorCode: TOOL_ERROR_CODES.youtubeSearchRateLimited },
  // No rate limiting for: get_current_datetime (instant), get_weather (cheap),
  // calculate_distance (cheap), get_exchange_rate (cheap), get_travel_tips (cheap),
  // get_local_events (moderate), trip management CRUD (protected by auth)
};
