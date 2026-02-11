/**
 * Web Scraper Handlers
 * Uses SearXNG + Crawlee for flights, hotels, events search
 * (Replaces Exa API — no API key needed)
 */

import cacheService from '../../../../../shared/services/CacheService.js';
import searxngService from '../SearxngService.js';
import crawleeService from '../CrawleeService.js';

// Cache TTL for tool results (in seconds)
const CACHE_TTL = {
  FLIGHTS: 1800,   // 30 minutes
  HOTELS: 3600,    // 1 hour
  EVENTS: 7200,    // 2 hours
};

/**
 * Search Flights via SearXNG + Crawlee
 */
export async function searchFlightsViaSearxng(args) {
  const { origin, destination, departure_date, return_date, passengers = 1 } = args;

  const cacheKey = `tool:flights:searxng:${origin}:${destination}:${departure_date}:${return_date || 'oneway'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  try {
    const tripType = return_date ? 'khứ hồi' : 'một chiều';
    const query = `vé máy bay ${origin} đến ${destination} ${departure_date} ${tripType}`;

    console.log(`[SearXNG] Flight search: "${query}"`);

    const searchResults = await searxngService.domainSearch(query, [
      'traveloka.com', 'google.com/travel/flights', 'skyscanner.com',
      'kayak.com', 'vietjetair.com', 'vietnamairlines.com', 'bambooairways.com',
      'trip.com', 'expedia.com',
    ], { limit: 8, language: 'vi' });

    // Deep crawl top results to extract real flight data
    let enrichedResults = searchResults.results;
    try {
      const topResults = searchResults.results.slice(0, 3);
      const deepCrawled = await Promise.allSettled(
        topResults.map(r => crawleeService.scrapeUrl(r.url, { maxLength: 4000 })
          .then(data => ({ ...r, ...data, enriched: true }))
          .catch(() => ({ ...r, enriched: false }))
        )
      );
      const crawled = deepCrawled.map(s => s.status === 'fulfilled' ? s.value : s.reason);
      enrichedResults = [...crawled, ...searchResults.results.slice(3)];
    } catch {
      // Use basic results if enrichment fails
    }

    const result = {
      source: 'searxng_web_search',
      origin,
      destination,
      departureDate: departure_date,
      returnDate: return_date,
      passengers,
      searchResults: enrichedResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content || '',
        snippet: (r.content || '').substring(0, 300),
        prices: r.prices || [],
        highlights: r.highlights || [],
        enriched: r.enriched || false,
        site: extractSiteName(r.url),
      })),
      bookingLinks: enrichedResults
        .filter(r => r.url)
        .map(r => ({ site: extractSiteName(r.url), url: r.url })),
      note: 'Kết quả từ web search. Dùng scrape_url để lấy thêm chi tiết từ URL cụ thể.',
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.FLIGHTS);
    return result;
  } catch (error) {
    console.error('SearXNG flight search error:', error.message);
    return { source: 'error', message: 'Không thể tìm chuyến bay', error: error.message };
  }
}

/**
 * Search Hotels via SearXNG + Crawlee
 */
export async function searchHotelsViaSearxng(args) {
  const { location, check_in, check_out, guests = 2, budget } = args;

  const cacheKey = `tool:hotels:searxng:${location}:${check_in}:${check_out}:${guests}:${budget || 'all'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  try {
    const budgetTerm = budget === 'luxury' ? 'sang trọng 5 sao' :
                       budget === 'mid-range' ? '4 sao giá tốt' :
                       budget === 'budget' ? 'giá rẻ' : '';
    const query = `khách sạn ${budgetTerm} ${location} ${check_in}`;

    console.log(`[SearXNG] Hotel search: "${query}"`);

    const searchResults = await searxngService.domainSearch(query, [
      'booking.com', 'agoda.com', 'hotels.com', 'traveloka.com',
      'expedia.com', 'tripadvisor.com', 'airbnb.com',
    ], { limit: 10, language: 'vi' });

    // Deep crawl top results to extract real hotel data
    let enrichedResults = searchResults.results;
    try {
      const topResults = searchResults.results.slice(0, 3);
      const deepCrawled = await Promise.allSettled(
        topResults.map(r => crawleeService.scrapeUrl(r.url, { maxLength: 4000 })
          .then(data => ({ ...r, ...data, enriched: true }))
          .catch(() => ({ ...r, enriched: false }))
        )
      );
      const crawled = deepCrawled.map(s => s.status === 'fulfilled' ? s.value : s.reason);
      enrichedResults = [...crawled, ...searchResults.results.slice(3)];
    } catch {
      // Use basic results if enrichment fails
    }

    const result = {
      source: 'searxng_web_search',
      location,
      checkIn: check_in,
      checkOut: check_out,
      guests,
      budget: budget || 'all',
      searchResults: enrichedResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content || '',
        snippet: (r.content || '').substring(0, 300),
        prices: r.prices || [],
        ratings: r.ratings || [],
        highlights: r.highlights || [],
        enriched: r.enriched || false,
        site: extractSiteName(r.url),
      })),
      bookingLinks: enrichedResults
        .filter(r => r.url)
        .map(r => ({ site: extractSiteName(r.url), url: r.url })),
      note: 'Kết quả từ web search. Dùng scrape_url để lấy thêm chi tiết từ URL cụ thể.',
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.HOTELS);
    return result;
  } catch (error) {
    console.error('SearXNG hotel search error:', error.message);
    return { source: 'error', message: 'Không thể tìm khách sạn', error: error.message };
  }
}

/**
 * Search Local Events via SearXNG + Crawlee
 */
export async function searchLocalEventsViaSearxng(args) {
  const { location, date_from, date_to, category } = args;

  const cacheKey = `tool:events:searxng:${location}:${date_from || 'now'}:${date_to || ''}:${category || 'all'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  try {
    const categoryTerm = getCategoryVietnamese(category);
    const dateTerm = date_from || new Date().getFullYear();
    const query = `sự kiện ${categoryTerm} ${location} ${dateTerm}`;

    console.log(`[SearXNG] Event search: "${query}"`);

    const searchResults = await searxngService.domainSearch(query, [
      'facebook.com', 'eventbrite.com', 'ticketbox.vn',
      'thiso.io', 'peatix.com', 'meetup.com',
    ], { limit: 12, language: 'vi' });

    // Deep crawl top results to extract real event data
    let enrichedResults = searchResults.results;
    try {
      const topResults = searchResults.results.slice(0, 3);
      const deepCrawled = await Promise.allSettled(
        topResults.map(r => crawleeService.scrapeUrl(r.url, { maxLength: 4000 })
          .then(data => ({ ...r, ...data, enriched: true }))
          .catch(() => ({ ...r, enriched: false }))
        )
      );
      const crawled = deepCrawled.map(s => s.status === 'fulfilled' ? s.value : s.reason);
      enrichedResults = [...crawled, ...searchResults.results.slice(3)];
    } catch {
      // Use basic results if enrichment fails
    }

    const result = {
      source: 'searxng_web_search',
      location,
      dateRange: { from: date_from, to: date_to },
      category: category || 'all',
      events: enrichedResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content || '',
        description: (r.content || '').substring(0, 300),
        prices: r.prices || [],
        highlights: r.highlights || [],
        enriched: r.enriched || false,
        platform: extractSiteName(r.url),
      })),
      note: 'Kết quả từ web search. Dùng scrape_url để lấy thêm chi tiết từ URL cụ thể.',
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.EVENTS);
    return result;
  } catch (error) {
    console.error('SearXNG event search error:', error.message);
    return { source: 'error', message: 'Không thể tìm sự kiện', error: error.message };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function extractSiteName(url) {
  try {
    const domain = new URL(url).hostname;
    const parts = domain.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Website';
  }
}

function getCategoryVietnamese(category) {
  const mapping = {
    music: 'âm nhạc concert',
    food: 'ẩm thực lễ hội',
    culture: 'văn hóa',
    sports: 'thể thao',
    art: 'nghệ thuật triển lãm',
    festival: 'lễ hội',
  };
  return mapping[category] || '';
}
