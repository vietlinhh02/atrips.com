/**
 * Search Handlers
 * Handles web search and place search operations
 * Now using SearXNG + Crawlee instead of Exa
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../../../../config/database.js';
import cacheService from '../../../../../shared/services/CacheService.js';
import { logger } from '../../../../../shared/services/LoggerService.js';
import serperService from '../SerperService.js';
import searxngService from '../SearxngService.js';
import crawleeService from '../CrawleeService.js';
import { isGeminiSearchEnabled } from '../../../domain/tools/index.js';

// Cache TTL for tool results (in seconds)
const TOOL_CACHE_TTL = {
  PLACES: 86400,      // 24 hours
  WEB_SEARCH: 1800,   // 30 minutes
};

// Pexels image fetching for place enrichment
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const placeImageCache = new Map();

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function fetchPlaceImage(query) {
  if (!PEXELS_API_KEY) return null;

  const cacheKey = query.toLowerCase().trim();
  if (placeImageCache.has(cacheKey)) return placeImageCache.get(cacheKey);

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      {
        headers: { Authorization: PEXELS_API_KEY },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const photos = data.photos.slice(0, 3).map(p => ({
        large: p.src.large2x || p.src.large,
        medium: p.src.medium,
        small: p.src.small,
      }));
      placeImageCache.set(cacheKey, photos);
      return photos;
    }
    return null;
  } catch {
    return null;
  }
}

async function addImagesToPlace(place, location) {
  // DB places may already have photos stored
  if (Array.isArray(place.photos) && place.photos.length > 0) {
    return {
      ...place,
      imageUrl: place.photos[0],
      thumbnailUrl: place.photos[0],
      sideImages: place.photos.slice(1, 3),
    };
  }

  const query = `${place.name} ${location || place.city || ''} ${place.type || ''}`.trim();
  const photos = await fetchPlaceImage(query).catch(() => null);

  if (photos && photos.length > 0) {
    return {
      ...place,
      imageUrl: photos[0].large,
      thumbnailUrl: photos[0].medium,
      sideImages: photos.slice(1).map(p => p.large),
    };
  }

  // Picsum fallback — deterministic seed from place name
  const seed = hashCode(place.name || query);
  return {
    ...place,
    imageUrl: `https://picsum.photos/seed/${seed}/600/400`,
    thumbnailUrl: `https://picsum.photos/seed/${seed}/300/200`,
    sideImages: [
      `https://picsum.photos/seed/${seed + 1}/300/200`,
      `https://picsum.photos/seed/${seed + 2}/300/200`,
    ],
  };
}

/**
 * Normalize a DB cached_place record to the same shape as a Mapbox place
 */
function normalizeDBPlace(place) {
  return {
    id: place.id,
    name: place.name,
    fullName: place.name,
    type: place.type?.toLowerCase() || 'attraction',
    address: place.address || '',
    city: place.city || '',
    coordinates: {
      lat: place.latitude,
      lng: place.longitude,
    },
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    ratingCount: place.ratingCount,
    priceLevel: place.priceLevel?.toLowerCase() || null,
    phone: place.phone || null,
    website: place.website || null,
    openingHours: place.openingHours || null,
    photos: place.photos || [],
    categories: [],
    source: 'database',
  };
}

/**
 * Create search handlers bound to executor context
 */
export function createSearchHandlers(executor) {
  return {
    webSearch: webSearch.bind(executor),
    scrapeUrl: scrapeUrl.bind(executor),
    searchPlaces: searchPlaces.bind(executor),
  };
}

/**
 * Web Search via Gemini Google Search grounding
 * Gọi riêng 1 API request chỉ với google_search tool, tránh conflict với function calling.
 * Timeout configurable via GEMINI_SEARCH_TIMEOUT_MS env var (default: 60s).
 * Retries once on timeout.
 */
const GEMINI_SEARCH_TIMEOUT_MS = parseInt(process.env.GEMINI_SEARCH_TIMEOUT_MS, 10) || 60000;
const GEMINI_SEARCH_MAX_RETRIES = 1;

async function webSearchViaGemini(args) {
  const { query } = args;

  const cacheKey = `tool:websearch:gemini:${query}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const baseUrl = process.env.OAI_BASE_URL || 'http://localhost:8317';
  const apiKey = process.env.OAI_API_KEY || '';
  const model = process.env.OAI_MODEL || process.env.AI_MODEL || 'gpt-4-turbo';

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const requestBody = JSON.stringify({
    model,
    messages: [{
      role: 'user',
      content: `${query}\n\nProvide factual, detailed information with specific names, addresses, prices, ratings, and URLs where available. Be concise and data-focused.`,
    }],
    tools: [{ google_search: {} }],
    temperature: 0.4,
    max_tokens: 4096,
  });

  let lastError = null;

  for (let attempt = 0; attempt <= GEMINI_SEARCH_MAX_RETRIES; attempt++) {
    const attemptLabel = attempt > 0 ? ` (retry ${attempt})` : '';
    logger.info('[Gemini Search] Query', { query: query.substring(0, 50), attempt: attempt || 0 });
    const startMs = Date.now();

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(GEMINI_SEARCH_TIMEOUT_MS),
      });

      const elapsedMs = Date.now() - startMs;

      if (!response.ok) {
        const error = await response.text();
        logger.error('[Gemini Search] Failed', { elapsedMs, error: error.substring(0, 300) });
        throw new Error(`Gemini search failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Extract grounding metadata if available (source URLs from Google Search)
      const groundingMeta = data.choices?.[0]?.message?.grounding_metadata
        || data.choices?.[0]?.grounding_metadata
        || null;

      logger.info('[Gemini Search] OK', { contentLength: content.length, elapsedMs, grounding: !!groundingMeta, promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens });

      // Build results with grounding sources if available
      const results = [{
        title: `Google Search: ${query}`,
        url: '',
        content,
        enriched: true,
        engine: 'gemini-grounding',
      }];

      // Add grounding sources as separate results for citation support
      if (groundingMeta?.search_entry_point?.rendered_content) {
        results[0].groundingHtml = groundingMeta.search_entry_point.rendered_content;
      }
      if (Array.isArray(groundingMeta?.grounding_chunks)) {
        for (const chunk of groundingMeta.grounding_chunks) {
          if (chunk.web?.uri) {
            results.push({
              title: chunk.web.title || '',
              url: chunk.web.uri,
              content: '',
              engine: 'google-grounding-source',
            });
          }
        }
      }

      const result = {
        source: 'gemini-google-search',
        query,
        searchType: 'google_search',
        results,
        totalResults: results.length,
      };

      await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.WEB_SEARCH);
      return result;
    } catch (error) {
      const elapsedMs = Date.now() - startMs;
      lastError = error;

      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error('[Gemini Search] Timeout', { elapsedSec: (elapsedMs / 1000).toFixed(1), query: query.substring(0, 50), attempt });
        // Retry on timeout
        if (attempt < GEMINI_SEARCH_MAX_RETRIES) {
          logger.info('[Gemini Search] Retrying');
          continue;
        }
      } else {
        logger.error('[Gemini Search] Error', { elapsedMs, error: error.message, attempt });
        // Don't retry on non-timeout errors
        break;
      }
    }
  }

  // Fallback: return empty result so the AI can still function
  return {
    source: 'gemini-google-search',
    query,
    searchType: 'google_search',
    results: [],
    totalResults: 0,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Web Search — Serper.dev (primary) → SearXNG (fallback)
 * Serper: Google Search API, structured data, no rate limits.
 * SearXNG: Self-hosted fallback when Serper key not configured.
 */
async function webSearch(args) {
  // Route to Gemini Google Search when enabled
  if (isGeminiSearchEnabled()) {
    return webSearchViaGemini(args);
  }

  const {
    query,
    type = 'auto',
    numResults = 5,
    recency = '6months',
    includeDomains = [],
    excludeDomains = [],
  } = args;

  const limit = Math.min(Math.max(1, numResults), 10);
  const currentYear = new Date().getFullYear();

  const cacheKey = `tool:websearch:${query}:${type}:${limit}:${recency}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // ── Try Serper.dev first (fast, reliable Google results) ──
  if (serperService.isAvailable) {
    try {
      const searchQuery = enhanceQueryWithYear(query, currentYear);
      const serperResult = await serperService.search({
        query: searchQuery,
        limit,
      });

      let filteredResults = serperResult.results || [];
      if (excludeDomains.length > 0) {
        filteredResults = filteredResults.filter(r =>
          !excludeDomains.some(d => r.url.includes(d)),
        );
      }
      if (includeDomains.length > 0) {
        const domainMatches = filteredResults.filter(r =>
          includeDomains.some(d => r.url.includes(d)),
        );
        if (domainMatches.length > 0) filteredResults = domainMatches;
      }

      const result = {
        source: 'serper',
        query,
        searchType: type,
        results: filteredResults.slice(0, limit),
        totalResults: filteredResults.length,
        knowledgeGraph: serperResult.knowledgeGraph,
        peopleAlsoAsk: serperResult.peopleAlsoAsk,
      };

      await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.WEB_SEARCH);
      return result;
    } catch (error) {
      logger.warn('[WebSearch] Serper failed, falling back to SearXNG', {
        error: error.message,
      });
    }
  }

  // ── Fallback: SearXNG ──
  try {
    let searchQuery = enhanceQueryWithYear(query, currentYear);

    if (includeDomains.length > 0) {
      const domainFilter = includeDomains.map(d => `site:${d}`).join(' OR ');
      searchQuery = `${searchQuery} (${domainFilter})`;
    }

    logger.info('[SearXNG] Search', { query: searchQuery.substring(0, 50), limit });

    const searchResults = await searxngService.search({
      query: searchQuery,
      limit: limit * 2,
      language: 'vi',
      category: 'general',
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return webSearchFallback(query, currentYear);
    }

    let filteredResults = searchResults.results;
    if (excludeDomains.length > 0) {
      filteredResults = filteredResults.filter(r => {
        return !excludeDomains.some(domain => r.url.includes(domain));
      });
    }

    filteredResults = filteredResults.slice(0, limit);

    // 4. Enrich top results with Crawlee (with timeout to avoid blocking)
    let enrichedResults = filteredResults;
    try {
      const topResults = filteredResults.slice(0, Math.min(2, limit));
      const enrichmentTimeout = 3000; // 3 second max for enrichment
      const enriched = await Promise.race([
        crawleeService.enrichResults(topResults, {
          maxResults: 2,
          includeHighlights: true,
          extractMetadata: true,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Enrichment timeout')), enrichmentTimeout)),
      ]);

      // Merge enriched results with remaining results
      enrichedResults = [
        ...enriched,
        ...filteredResults.slice(enriched.length),
      ];
    } catch (crawlError) {
      logger.warn('[SearXNG] Crawlee enrichment skipped', { error: crawlError.message });
      // Continue with basic results - SearXNG snippets are usually sufficient
    }

    const result = {
      source: 'searxng+crawlee',
      query: searchQuery,
      originalQuery: query,
      searchType: type,
      dateFilter: {
        recency,
        currentYear,
      },
      results: enrichedResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content || '',
        publishedDate: r.publishedDate,
        author: r.author,
        score: r.score || 0,
        highlights: r.highlights || [],
        enriched: r.enriched || false,
        engine: r.engine,
      })),
      totalResults: enrichedResults.length,
      engines: searchResults.engines || [],
      suggestions: searchResults.suggestions || [],
    };

    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.WEB_SEARCH);

    return result;
  } catch (error) {
    logger.error('[SearXNG] Search error', { error: error.message });
    return webSearchFallback(query, currentYear);
  }
}

/**
 * Scrape URL - Deep crawl a specific URL for detailed content
 * Used after web_search to get full page content
 */
async function scrapeUrl(args) {
  const { url, maxLength = 5000 } = args;

  if (!url || typeof url !== 'string') {
    return { success: false, error: 'URL is required' };
  }

  const clampedLength = Math.min(Math.max(1000, maxLength), 8000);

  const cacheKey = `tool:scrapeurl:${url}:${clampedLength}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  try {
    logger.info('[ScrapeUrl] Crawling', { url, maxLength: clampedLength });

    const data = await crawleeService.scrapeUrl(url, { maxLength: clampedLength });

    const result = {
      source: 'crawlee',
      url: data.scrapedUrl || url,
      title: data.title || '',
      description: data.description || '',
      content: data.content || '',
      highlights: data.highlights || [],
      metadata: data.metadata || {},
      prices: data.prices || [],
      ratings: data.ratings || [],
      location: data.location || null,
      crawler: data.crawler || 'unknown',
      scrapedAt: data.scrapedAt,
    };

    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.WEB_SEARCH);

    return result;
  } catch (error) {
    logger.error('[ScrapeUrl] Scrape URL error', { error: error.message, url });
    return {
      success: false,
      error: `Không thể crawl URL: ${error.message}`,
      url,
    };
  }
}

/**
 * Search Places - Mapbox Search API
 */
async function searchPlaces(args) {
  const { query, location, type, limit = 5 } = args;

  const effectiveLimit = Math.min(Math.max(1, limit), 10);
  const cacheKey = `tool:places:${location}:${type || 'all'}:${query || ''}:${effectiveLimit}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const rawDbPlaces = await searchPlacesFromDB(args);
  if (rawDbPlaces.length > 0) {
    const normalized = rawDbPlaces.map(normalizeDBPlace);
    const enriched = await Promise.all(normalized.map(p => addImagesToPlace(p, location)));
    const result = { source: 'database', places: enriched };
    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);
    return result;
  }

  // Primary: Serper Places (Google Maps data — reliable, rich)
  if (serperService.isAvailable) {
    try {
      const searchTerm = query || getDefaultSearchTerm(type);
      const searchQuery = `${searchTerm} ${location}`;
      const serperResult = await serperService.searchPlaces({ query: searchQuery });

      if (serperResult?.places?.length > 0) {
        const places = await Promise.all(
          serperResult.places.slice(0, effectiveLimit).map(p => addImagesToPlace({
            name: p.name,
            address: p.address || '',
            latitude: p.latitude,
            longitude: p.longitude,
            coordinates: p.latitude ? { lat: p.latitude, lng: p.longitude } : null,
            rating: p.rating,
            ratingCount: p.ratingCount,
            type: type || inferTypeFromCategory(p.category),
            category: p.category,
            phone: p.phone,
            website: p.website,
            source: 'serper',
          }, location)),
        );

        const result = { success: true, source: 'serper', places, query: searchQuery };
        await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);
        return result;
      }
    } catch (error) {
      logger.warn('[searchPlaces] Serper failed, trying Mapbox', { error: error.message });
    }
  }

  // Fallback: Mapbox (if token available)
  if (this.mapboxToken) {
    try {
      const searchTerm = query || getDefaultSearchTerm(type);
      const searchQuery = `${searchTerm} ${location}`;
      const rawPlaces = await searchViaMapboxSearchBox(
        searchQuery, this.mapboxToken, effectiveLimit, args, type,
      );
      if (rawPlaces.length > 0) {
        const places = await Promise.all(rawPlaces.map(p => addImagesToPlace(p, location)));
        const result = { success: true, source: 'mapbox', places, query: searchQuery };
        await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);
        savePlacesToDB(rawPlaces, location);
        return result;
      }
    } catch (error) {
      logger.warn('[searchPlaces] Mapbox failed', { error: error.message });
    }
  }

  return searchPlacesFallback(args);
}

async function searchPlacesFromDB(args) {
  const { query, location, type, limit = 5 } = args;

  try {
    return await prisma.cached_places.findMany({
      where: {
        OR: [
          { city: { contains: location, mode: 'insensitive' } },
          { address: { contains: location, mode: 'insensitive' } },
        ],
        ...(type && { type: mapPlaceTypeToDB(type) }),
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { categories: { hasSome: [query] } },
          ],
        }),
      },
      take: limit,
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        city: true,
        rating: true,
        ratingCount: true,
        priceLevel: true,
        phone: true,
        website: true,
        openingHours: true,
        photos: true,
        latitude: true,
        longitude: true,
        provider: true,
        externalId: true,
      },
    });
  } catch (error) {
    logger.warn('[searchPlaces] Failed to fetch places from database', { error: error.message });
    return [];
  }
}

async function savePlacesToDB(places, city) {
  try {
    for (const place of places) {
      if (!place.coordinates?.lat || !place.coordinates?.lng) {
        continue;
      }

      const externalId = `${place.name}_${city}`.substring(0, 255);

      await prisma.cached_places.upsert({
        where: {
          provider_externalId: {
            provider: 'mapbox',
            externalId: externalId,
          },
        },
        create: {
          externalId: externalId,
          provider: 'mapbox',
          name: place.name,
          type: mapPlaceTypeToDB(place.type) || 'OTHER',
          address: place.address,
          city: city,
          latitude: place.coordinates.lat,
          longitude: place.coordinates.lng,
          categories: place.categories || [],
        },
        update: {
          address: place.address,
          latitude: place.coordinates.lat,
          longitude: place.coordinates.lng,
        },
      });
    }
  } catch (error) {
    logger.error('[searchPlaces] Error saving places to DB', { error: error.message });
  }
}

// Helper functions
function calculateStartDate(recency) {
  if (recency === 'all') {
    return null;
  }

  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let daysToSubtract;

  switch (recency) {
    case 'week':
      daysToSubtract = 7;
      break;
    case 'month':
      daysToSubtract = 30;
      break;
    case '3months':
      daysToSubtract = 90;
      break;
    case '6months':
      daysToSubtract = 180;
      break;
    case 'year':
      daysToSubtract = 365;
      break;
    default:
      daysToSubtract = 180; // Default to 6 months
  }

  const startDate = new Date(now.getTime() - (daysToSubtract * MS_PER_DAY));
  return startDate.toISOString().split('T')[0];
}

function enhanceQueryWithYear(query, currentYear) {
  const yearPattern = /\b(202[0-9]|2030)\b/;
  if (yearPattern.test(query)) {
    return query;
  }
  return `${query} ${currentYear}`;
}

function webSearchFallback(query, currentYear) {
  return {
    source: 'fallback',
    query,
    currentYear,
    results: [],
    message: 'Web search không khả dụng. Vui lòng kiểm tra SearXNG service.',
    note: 'Chạy "docker compose up -d" để khởi động SearXNG',
  };
}

/**
 * Mapbox Search Box API v1 — proper POI search
 */
async function searchViaMapboxSearchBox(
  searchQuery, token, limit, args, type,
) {
  try {
    const params = new URLSearchParams({
      q: searchQuery,
      access_token: token,
      limit: String(limit),
      language: 'vi',
      types: 'poi',
      session_token: randomUUID(),
    });
    if (args.longitude && args.latitude) {
      params.set('proximity', `${args.longitude},${args.latitude}`);
    }
    const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];

    const data = await resp.json();
    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) return [];

    // Retrieve full details for each suggestion
    const places = [];
    for (const s of suggestions.slice(0, limit)) {
      if (!s.mapbox_id) continue;
      try {
        const detailResp = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}?` +
          `access_token=${token}&language=vi`,
        );
        if (!detailResp.ok) continue;
        const detail = await detailResp.json();
        const feat = detail.features?.[0];
        if (!feat) continue;
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [];
        places.push({
          name: props.name || s.name,
          fullName: props.full_address || props.place_formatted || s.full_address || '',
          type: type || detectPlaceTypeFromCategories(props.poi_category || []),
          address: props.full_address || props.place_formatted || '',
          city: props.context?.place?.name || extractCityFromAddress(props.full_address || ''),
          coordinates: { lat: coords[1], lng: coords[0] },
          latitude: coords[1],
          longitude: coords[0],
          relevance: 1,
          categories: props.poi_category || [],
          phone: props.metadata?.phone || null,
          website: props.metadata?.website || null,
          openingHours: null,
          photos: [],
          source: 'mapbox_search',
        });
      } catch {
        // Skip failed detail fetch
      }
    }
    if (places.length > 0) {
      logger.info('[searchPlaces] Mapbox Search Box returned results', { count: places.length, query: searchQuery.substring(0, 50) });
    }
    return places;
  } catch (err) {
    logger.warn('[searchPlaces] Mapbox Search Box API error', { error: err.message });
    return [];
  }
}

function detectPlaceTypeFromCategories(categories) {
  const cats = categories.map(c => c.toLowerCase()).join(' ');
  if (/restaurant|food|dining/.test(cats)) return 'restaurant';
  if (/hotel|lodging|resort/.test(cats)) return 'hotel';
  if (/cafe|coffee/.test(cats)) return 'cafe';
  if (/museum|monument|temple|park|attraction/.test(cats)) return 'attraction';
  if (/shop|market|mall/.test(cats)) return 'shopping';
  return 'attraction';
}

function extractCityFromAddress(address) {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

/**
 * Mapbox Geocoding v5 fallback — less accurate for POI search
 */
async function searchViaMapboxGeocoding(
  searchQuery, token, limit, args, type,
) {
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
      `access_token=${token}&limit=${limit}&language=vi&types=poi`;
    if (args.longitude && args.latitude) {
      url += `&proximity=${args.longitude},${args.latitude}`;
    }
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    return (data.features || []).map(feature => ({
      name: feature.text,
      fullName: feature.place_name,
      type: type || detectPlaceType(feature),
      address: feature.place_name,
      city: extractCity(feature),
      coordinates: { lat: feature.center[1], lng: feature.center[0] },
      latitude: feature.center[1],
      longitude: feature.center[0],
      relevance: feature.relevance,
      categories: feature.properties?.category?.split(', ') || [],
      phone: feature.properties?.tel || null,
      website: feature.properties?.website || null,
      openingHours: feature.properties?.open_hours || null,
      photos: [],
      source: 'mapbox',
    }));
  } catch (err) {
    logger.warn('[searchPlaces] Mapbox Geocoding v5 error', { error: err.message });
    return [];
  }
}

function inferTypeFromCategory(category) {
  if (!category) return 'attraction';
  const c = category.toLowerCase();
  if (/restaurant|food|ăn|quán|nhà hàng|cafe|coffee/i.test(c)) return 'restaurant';
  if (/hotel|khách sạn|resort|hostel|homestay/i.test(c)) return 'hotel';
  if (/bar|club|nightlife|pub/i.test(c)) return 'nightlife';
  if (/tour|activity|experience/i.test(c)) return 'activity';
  if (/shop|market|mall|chợ/i.test(c)) return 'shopping';
  return 'attraction';
}

function searchPlacesFallback(args) {
  const { query, location, type } = args;
  const errorMsg = `Không tìm thấy địa điểm "${query || type || 'all'}" tại ${location}. Hãy thử dùng web_search để tìm từ internet.`;
  return {
    success: false,
    error: errorMsg,
    source: 'fallback',
    places: [],
    message: errorMsg,
    suggestion: 'Use web_search tool to find places from the internet instead.',
  };
}

function mapPlaceTypeToMapbox(type) {
  const mapping = {
    restaurant: 'poi',
    hotel: 'poi',
    attraction: 'poi',
    cafe: 'poi',
    shopping: 'poi',
    entertainment: 'poi',
  };
  return mapping[type] || 'poi';
}

function mapPlaceTypeToDB(type) {
  const mapping = {
    restaurant: 'RESTAURANT',
    hotel: 'HOTEL',
    attraction: 'ATTRACTION',
    cafe: 'RESTAURANT',
    shopping: 'OTHER',
    entertainment: 'ACTIVITY',
  };
  return mapping[type] || 'OTHER';
}

function detectPlaceType(feature) {
  const categories = feature.properties?.category?.toLowerCase() || '';
  if (categories.includes('restaurant') || categories.includes('food')) return 'restaurant';
  if (categories.includes('hotel') || categories.includes('lodging')) return 'hotel';
  if (categories.includes('cafe') || categories.includes('coffee')) return 'cafe';
  if (categories.includes('shop') || categories.includes('store')) return 'shopping';
  return 'attraction';
}

function extractCity(feature) {
  const context = feature.context || [];
  const place = context.find(c => c.id.startsWith('place.'));
  return place?.text || '';
}

function getDefaultSearchTerm(type) {
  const terms = {
    restaurant: 'popular restaurants',
    hotel: 'hotels',
    attraction: 'tourist attractions',
    cafe: 'coffee shops',
    shopping: 'shopping',
    entertainment: 'entertainment',
  };
  return terms[type] || 'points of interest';
}

// Mock places generation removed to prevent AI Hallucination

// Export helper functions for use in other handlers
export {
  mapPlaceTypeToDB,
  detectPlaceType,
  extractCity,
  getDefaultSearchTerm,
};
