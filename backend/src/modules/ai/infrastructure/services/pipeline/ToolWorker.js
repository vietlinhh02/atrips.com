/**
 * Tool Worker (Layer 2.5 — API-based)
 * Replaces browser-use WorkerClient with direct API + Serper calls.
 * Each task type uses Serper Places (Google data) + web_search for context.
 * Zero Chrome instances needed.
 */

import toolExecutor from '../ToolExecutor.js';
import serperService from '../SerperService.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * Serper Places query templates per task type.
 * Returns real Google Maps data: name, rating, ratingCount, address,
 * latitude, longitude, category, phone, website, cid.
 */
const SERPER_PLACES_QUERIES = {
  attractions: (ctx) => [
    `tourist attractions ${ctx.destination}`,
    `things to do ${ctx.destination}`,
  ],
  restaurants: (ctx) => [
    `best restaurants ${ctx.destination}`,
    `local food ${ctx.destination}`,
  ],
  activities: (ctx) => [
    `activities tours experiences ${ctx.destination}`,
  ],
  nightlife: (ctx) => [
    `nightlife bars night market ${ctx.destination}`,
  ],
};

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

      // 1. Serper Places (if applicable — structured Google data)
      const placeQueries = SERPER_PLACES_QUERIES[task.taskType];
      if (placeQueries && serperService.isAvailable) {
        for (const q of placeQueries(ctx)) {
          promises.push(
            serperService.searchPlaces({ query: q })
              .then(r => ({ type: 'places', data: r }))
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
          }).then(r => r?.success ? { type: 'web', data: r.data } : null)
            .catch(() => null),
        );
      }

      // Weather forecast for travel dates
      if (ctx.destination && ctx.startDate) {
        promises.push(
          toolExecutor.execute('get_weather', {
            location: ctx.destination,
            date: ctx.startDate,
          }).then(r => r?.success ? { type: 'weather', data: r.data } : null)
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

      const hasData = places.length > 0
        || webResults.length > 0
        || weatherData;

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
