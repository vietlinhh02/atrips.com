/**
 * Search Handlers
 * Handles web search and place search operations
 * Now using SearXNG + Crawlee instead of Exa
 */

import prisma from '../../../../../config/database.js';
import cacheService from '../../../../../shared/services/CacheService.js';
import searxngService from '../SearxngService.js';
import crawleeService from '../CrawleeService.js';

// Cache TTL for tool results (in seconds)
const TOOL_CACHE_TTL = {
  PLACES: 86400,      // 24 hours
  WEB_SEARCH: 1800,   // 30 minutes
};

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
 * Web Search - SearXNG + Crawlee (Exa replacement)
 * No rate limits when self-hosted
 * Default: Current year enhanced search
 */
async function webSearch(args) {
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

  try {
    // Build search query with domain filters
    let searchQuery = enhanceQueryWithYear(query, currentYear);

    if (includeDomains.length > 0) {
      const domainFilter = includeDomains.map(d => `site:${d}`).join(' OR ');
      searchQuery = `${searchQuery} (${domainFilter})`;
    }

    console.log(`[SearXNG] Search: "${searchQuery}" (limit: ${limit})`);

    // 1. Get search results from SearXNG
    const searchResults = await searxngService.search({
      query: searchQuery,
      limit: limit * 2, // Get more results for better selection
      language: 'vi',
      category: 'general',
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return webSearchFallback(query, currentYear);
    }

    // 2. Filter by excluded domains
    let filteredResults = searchResults.results;
    if (excludeDomains.length > 0) {
      filteredResults = filteredResults.filter(r => {
        return !excludeDomains.some(domain => r.url.includes(domain));
      });
    }

    // 3. Limit results
    filteredResults = filteredResults.slice(0, limit);

    // 4. Enrich top results with Crawlee (optional - for better quality)
    let enrichedResults = filteredResults;
    try {
      const topResults = filteredResults.slice(0, Math.min(3, limit));
      const enriched = await crawleeService.enrichResults(topResults, {
        maxResults: 3,
        includeHighlights: true,
        extractMetadata: true,
      });

      // Merge enriched results with remaining results
      enrichedResults = [
        ...enriched,
        ...filteredResults.slice(enriched.length),
      ];
    } catch (crawlError) {
      console.warn('Crawlee enrichment failed, using basic results:', crawlError.message);
      // Continue with basic results if enrichment fails
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
    console.error('SearXNG search error:', error.message);
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
    console.log(`[ScrapeUrl] Crawling: ${url} (maxLength: ${clampedLength})`);

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
    console.error('Scrape URL error:', error.message);
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

  const dbPlaces = await searchPlacesFromDB(args);
  if (dbPlaces.length > 0) {
    const result = { source: 'database', places: dbPlaces };
    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);
    return result;
  }

  if (!this.mapboxToken) {
    return searchPlacesFallback(args);
  }

  try {
    const searchTerm = query || getDefaultSearchTerm(type);
    const searchQuery = `${searchTerm} ${location}`;

    // Build Mapbox URL with POI type filter and proximity
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
      `access_token=${this.mapboxToken}&limit=${effectiveLimit}&language=vi&types=poi`;

    // Add proximity if coordinates are available from context
    if (args.longitude && args.latitude) {
      url += `&proximity=${args.longitude},${args.latitude}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    const places = data.features.map(feature => ({
      name: feature.text,
      fullName: feature.place_name,
      type: type || detectPlaceType(feature),
      address: feature.place_name,
      city: extractCity(feature),
      coordinates: {
        lat: feature.center[1],
        lng: feature.center[0],
      },
      latitude: feature.center[1],
      longitude: feature.center[0],
      relevance: feature.relevance,
      categories: feature.properties?.category?.split(', ') || [],
      phone: feature.properties?.tel || null,
      website: feature.properties?.website || null,
      openingHours: feature.properties?.open_hours || null,
      source: 'mapbox',
    }));

    const result = {
      source: 'mapbox',
      places,
      query: searchQuery,
    };

    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);

    savePlacesToDB(result.places, location);

    return result;
  } catch (error) {
    console.error('Mapbox search error:', error.message);
    return searchPlacesFallback(args);
  }
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
    console.warn('Failed to fetch places from database:', error.message);
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
    console.error('Error saving places to DB:', error.message);
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

function searchPlacesFallback(args) {
  const { query, location, type, limit = 5 } = args;
  return {
    source: 'fallback',
    places: generateMockPlaces(location, type, query, limit),
    note: 'Dữ liệu tham khảo - Vui lòng cấu hình MAPBOX_ACCESS_TOKEN để có kết quả chính xác',
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

function generateMockPlaces(location, type, query, limit) {
  const places = [];
  const types = {
    restaurant: ['Nhà hàng', 'Quán ăn', 'Bistro'],
    hotel: ['Khách sạn', 'Resort', 'Homestay'],
    attraction: ['Điểm tham quan', 'Bảo tàng', 'Công viên'],
    cafe: ['Quán cà phê', 'Coffee House', 'Cafe'],
    shopping: ['Trung tâm mua sắm', 'Chợ', 'Cửa hàng'],
    entertainment: ['Khu vui chơi', 'Rạp chiếu phim', 'Bar'],
  };

  const prefixes = types[type] || ['Địa điểm'];

  for (let i = 0; i < limit; i++) {
    places.push({
      name: `${prefixes[i % prefixes.length]} ${query || ''} ${location} ${i + 1}`.trim(),
      type: type || 'attraction',
      address: `${100 + i} Đường chính, ${location}`,
      rating: (4 + Math.random()).toFixed(1),
      reviewCount: Math.floor(Math.random() * 500) + 50,
      priceLevel: ['budget', 'mid-range', 'luxury'][Math.floor(Math.random() * 3)],
    });
  }

  return places;
}

// Export helper functions for use in other handlers
export {
  mapPlaceTypeToDB,
  detectPlaceType,
  extractCity,
  getDefaultSearchTerm,
};
