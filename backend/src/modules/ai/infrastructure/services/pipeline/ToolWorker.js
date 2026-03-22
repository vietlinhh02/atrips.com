/**
 * Tool Worker (Layer 2.5 — API-based)
 * Replaces browser-use WorkerClient with direct API + Serper calls.
 * Each task type uses Serper Places (Google data) + web_search for context.
 * Zero Chrome instances needed.
 */

import toolExecutor from '../ToolExecutor.js';
import serperService from '../SerperService.js';
import { searchMapboxPlaces } from '../handlers/searchHandlers.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

const GENERIC_FALLBACK = {
  attractions: (ctx) => `things to do ${ctx.destination}`,
  restaurants: (ctx) => `local food ${ctx.destination}`,
  activities: (ctx) => `tours experiences ${ctx.destination}`,
  nightlife: (ctx) => `nightlife ${ctx.destination}`,
};

const IS_VIETNAM = /vi[eệ]t\s*nam|hà\s*n[oộ]i|đ[aà]\s*n[aẵ]ng|sài\s*gòn|hcm|huế|hội\s*an|nha\s*trang|đà\s*lạt|phú\s*quốc/i;

const DIVERSITY_ANGLES = {
  restaurants: {
    vi: [
      (dest) => `${dest} street food chợ đêm quán vỉa hè`,
      (dest) => `${dest} nhà hàng đặc sản địa phương ngon nổi tiếng`,
      (dest) => `${dest} quán ăn hidden gem locals yêu thích ít khách du lịch`,
    ],
    en: [
      (dest) => `${dest} street food night market local stalls`,
      (dest) => `${dest} best local specialty restaurants authentic`,
      (dest) => `${dest} hidden gem restaurants locals favorite off tourist trail`,
    ],
  },
  activities: {
    vi: [
      (dest) => `${dest} workshop cooking class trải nghiệm thủ công`,
      (dest) => `${dest} thiên nhiên outdoor hiking cycling`,
    ],
    en: [
      (dest) => `${dest} workshop cooking class handcraft experience`,
      (dest) => `${dest} nature outdoor hiking cycling adventure`,
    ],
  },
  attractions: {
    vi: [
      (dest) => `${dest} điểm đến ít người biết hidden gems địa phương`,
    ],
    en: [
      (dest) => `${dest} hidden gems off-the-beaten-path local favorites`,
    ],
  },
  nightlife: {
    vi: [
      (dest) => `${dest} rooftop bar live music quán bar đêm`,
    ],
    en: [
      (dest) => `${dest} rooftop bar live music local nightlife`,
    ],
  },
};

function getPlacesQueries(task) {
  const ctx = task.context || {};
  const dest = ctx.destination || '';
  const generic = GENERIC_FALLBACK[task.taskType]?.(ctx);
  const queries = [];
  if (task.query) queries.push(task.query);
  if (generic && generic !== task.query) queries.push(generic);

  const angleSet = DIVERSITY_ANGLES[task.taskType];
  if (angleSet) {
    const lang = IS_VIETNAM.test(dest) ? 'vi' : 'en';
    for (const angleFn of angleSet[lang]) {
      const q = angleFn(dest);
      if (!queries.includes(q)) queries.push(q);
    }
  }

  if (queries.length === 0) queries.push(`points of interest ${dest}`);
  return queries;
}

/**
 * Web search queries for enrichment context.
 */
const WEB_SEARCH_QUERIES = {
  attractions: (q, ctx) => q || `${ctx.destination} top attractions opening hours entrance fee ${new Date().getFullYear()}`,
  restaurants: (q, ctx) => q || `${ctx.destination} best local food restaurants ${new Date().getFullYear()}`,
  hotels: (q, ctx) => q || `${ctx.destination} hotels accommodation ${ctx.budget || ''} ${new Date().getFullYear()}`,
  transport: (q, ctx) => q || `${ctx.destination} transportation getting around weather tips ${new Date().getFullYear()}`,
  activities: (q, ctx) => q || `${ctx.destination} unique experiences tours ${new Date().getFullYear()}`,
  nightlife: (q, ctx) => q || `${ctx.destination} nightlife evening entertainment ${new Date().getFullYear()}`,
};

export class ToolWorker {
  /**
   * Execute a single task using Serper Places + web_search.
   *
   * @param {import('./OrchestratorAgent.js').WorkerTask} task
   * @returns {Promise<{taskId: string, status: string, data: any, error?: string}>}
   */
  async executeTask(task) {
    const startTime = Date.now();
    const ctx = task.context || {};

    try {
      logger.info('[ToolWorker] Executing task:', {
        taskId: task.taskId,
        taskType: task.taskType,
      });

      const promises = [];

      // 1. Serper Places + Mapbox (parallel — wider data pool)
      const placeQueries = getPlacesQueries(task);
      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

      for (const q of placeQueries) {
        // Serper Places — primary source, skip cache
        if (serperService.isAvailable) {
          promises.push(
            serperService.searchPlaces({ query: q, skipCache: true })
              .then(r => ({ type: 'places', data: r }))
              .catch(() => null),
          );
        }

        // Mapbox Search Box — secondary source, runs in parallel
        if (mapboxToken) {
          promises.push(
            searchMapboxPlaces(q, mapboxToken, 5)
              .then(places => places.length > 0
                ? { type: 'places', data: { places, source: 'mapbox' } }
                : null)
              .catch(() => null),
          );
        }
      }

      // 2. Hotels via Serper (Google Places + web search)
      if (task.taskType === 'hotels' && serperService.isAvailable) {
        promises.push(
          serperService.searchHotels({
            destination: ctx.destination,
            checkin: ctx.startDate || '',
            checkout: ctx.endDate || '',
            guests: ctx.groupSize || 2,
            budget: ctx.budget || 'mid-range',
            skipCache: true,
          }).then(r => ({ type: 'hotels', data: r }))
            .catch(() => null),
        );
      }

      // 3. Web search for context/enrichment
      const webQuery = WEB_SEARCH_QUERIES[task.taskType];
      if (webQuery) {
        promises.push(
          toolExecutor.execute('web_search', {
            query: webQuery(task.query, ctx),
            numResults: 5,
          }, { noCache: true }).then(r => r?.success ? { type: 'web', data: r.data } : null)
            .catch(() => null),
        );
      }

      // Weather forecast for travel dates (only for first task to avoid duplicates)
      if (ctx.destination && ctx.startDate && task.taskType === 'attractions') {
        promises.push(
          toolExecutor.execute('get_weather', {
            location: ctx.destination,
            date: ctx.startDate,
          }, { noCache: true }).then(r => r?.success ? { type: 'weather', data: r.data } : null)
            .catch(() => null),
        );
      }

      // Exchange rate for international trips (non-Vietnam destinations)
      if (task.taskType === 'hotels' && ctx.destination) {
        const isVietnam = /vi[eệ]t\s*nam|hà\s*n[oộ]i|đ[aà]\s*n[aẵ]ng|sài\s*gòn|hcm|huế|hội\s*an|nha\s*trang|đà\s*lạt|phú\s*quốc/i.test(ctx.destination);
        if (!isVietnam) {
          promises.push(
            toolExecutor.execute('get_exchange_rate', {
              from: 'USD',
              to: 'VND',
            }, { noCache: true }).then(r => r?.success ? { type: 'exchange', data: r.data } : null)
              .catch(() => null),
          );
        }
      }

      // Local events during trip dates
      if (task.taskType === 'activities' && ctx.destination && ctx.startDate) {
        promises.push(
          toolExecutor.execute('get_local_events', {
            location: ctx.destination,
            startDate: ctx.startDate,
            endDate: ctx.endDate || ctx.startDate,
          }, { noCache: true }).then(r => r?.success && r.data?.events?.length > 0
            ? { type: 'events', data: r.data }
            : null,
          ).catch(() => null),
        );
      }

      // Serper Images for destination cover photos
      if (task.taskType === 'attractions' && serperService.isAvailable) {
        promises.push(
          serperService.searchImages?.({
            query: `${ctx.destination} travel photography`,
            limit: 5,
            skipCache: true,
          }).then(r => r ? { type: 'images', data: r } : null)
            .catch(() => null),
        );
      }

      // Transport: also search for flights via Serper if applicable
      if (task.taskType === 'transport' && serperService.isAvailable) {
        const hasOrigin = task.query.match(/from\s+(\w+)|từ\s+(\w+)/i);
        if (hasOrigin) {
          promises.push(
            serperService.searchFlights({
              origin: hasOrigin[1] || hasOrigin[2],
              destination: ctx.destination,
              departureDate: ctx.startDate || '',
              returnDate: ctx.endDate || '',
              passengers: ctx.groupSize || 1,
            }).then(r => ({ type: 'flights', data: r }))
              .catch(() => null),
          );
        }
      }

      // Run all in parallel
      const results = await Promise.allSettled(promises);

      // Merge results
      const places = [];
      const webResults = [];
      let weatherData = null;
      let exchangeData = null;
      let eventsData = null;
      let imagesData = null;
      const seenNames = new Set();

      for (const outcome of results) {
        if (outcome.status !== 'fulfilled' || !outcome.value) continue;
        const { type, data } = outcome.value;

        if (type === 'places' && data?.places) {
          for (const p of data.places) {
            const key = (p.name || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
              seenNames.add(key);
              places.push(p);
            }
          }
        } else if (type === 'hotels' && data) {
          if (data.hotels) {
            for (const h of data.hotels) {
              const key = (h.name || '').toLowerCase().trim();
              if (key && !seenNames.has(key)) {
                seenNames.add(key);
                places.push({ ...h, type: 'hotel' });
              }
            }
          }
          if (data.webContext) {
            for (const r of data.webContext) webResults.push(r);
          }
        } else if (type === 'flights' && data?.results) {
          for (const r of data.results) {
            webResults.push({
              title: r.title,
              url: r.url,
              snippet: r.content || r.snippet || '',
            });
          }
        } else if (type === 'weather' && data) {
          weatherData = data;
        } else if (type === 'exchange' && data) {
          exchangeData = data;
        } else if (type === 'events' && data) {
          eventsData = data;
        } else if (type === 'images' && data) {
          imagesData = data;
        } else if (type === 'web' && data?.results) {
          for (const r of data.results) {
            webResults.push({
              title: r.title,
              url: r.url,
              snippet: r.content || r.snippet || '',
            });
          }
        }
      }

      // Build merged output
      const mergedData = {};
      if (places.length > 0) mergedData.places = places;
      if (webResults.length > 0) mergedData.webContext = webResults;
      if (weatherData) mergedData.weather = weatherData;
      if (exchangeData) mergedData.exchangeRate = exchangeData;
      if (eventsData) mergedData.events = eventsData;
      if (imagesData) mergedData.images = imagesData;

      const hasData = places.length > 0
        || webResults.length > 0
        || weatherData
        || eventsData;

      logger.info('[ToolWorker] Task completed:', {
        taskId: task.taskId,
        status: hasData ? 'success' : 'empty',
        durationMs: Date.now() - startTime,
        places: places.length,
        webResults: webResults.length,
      });

      return {
        taskId: task.taskId,
        status: hasData ? 'success' : 'error',
        data: hasData ? mergedData : null,
        error: hasData ? undefined : 'No data from API tools',
      };
    } catch (error) {
      logger.error('[ToolWorker] Task failed:', {
        taskId: task.taskId,
        error: error.message,
        durationMs: Date.now() - startTime,
      });
      return {
        taskId: task.taskId,
        status: 'error',
        data: null,
        error: error.message,
      };
    }
  }

  async healthCheck() {
    return true;
  }
}
