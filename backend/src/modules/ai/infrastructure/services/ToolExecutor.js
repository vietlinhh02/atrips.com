/**
 * Tool Executor Service
 * Handles execution of AI tool calls with real API integrations
 */

import { createHash } from 'node:crypto';
import {
  createSearchHandlers,
  createInfoHandlers,
  createBookingHandlers,
  createPlanningHandlers,
  createTripManagementHandlers,
  createSocialMediaHandlers,
} from './handlers/index.js';
import { logger } from '../../../../shared/services/LoggerService.js';
import cacheService from '../../../../shared/services/CacheService.js';

/** TTL in seconds, keyed by tool name. */
const TOOL_CACHE_TTL = {
  web_search: 3600,
  scrape_url: 3600,
  search_places: 86400,
  get_place_details: 86400,
  get_weather: 10800,
  search_flights: 1800,
  search_hotels: 1800,
  get_exchange_rate: 21600,
  calculate_distance: 604800,
};
const DEFAULT_CACHE_TTL = 3600;

/** Tools that mutate data — never cache. */
const MUTATING_TOOLS = new Set([
  'add_activity',
  'update_activity',
  'delete_activity',
  'reorder_activities',
  'update_trip',
  'delete_trip',
  'create_trip_plan',
  'apply_draft_to_trip',
  'add_day_to_trip',
  'update_day',
  'delete_day',
  'optimize_itinerary',
]);

/** Param keys that indicate user-specific data — skip cache. */
const USER_SPECIFIC_PARAMS = new Set([
  'conversationId',
  'userId',
]);

function generateCacheKey(toolName, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj, key) => {
      obj[key] = params[key];
      return obj;
    }, {});
  const hash = createHash('md5')
    .update(`${toolName}:${JSON.stringify(sortedParams)}`)
    .digest('hex');
  return `tool:${hash}`;
}

function isCacheable(toolName, params) {
  if (MUTATING_TOOLS.has(toolName)) return false;
  for (const key of Object.keys(params)) {
    if (USER_SPECIFIC_PARAMS.has(key)) return false;
  }
  return true;
}

class ToolExecutor {
  constructor() {
    // SearXNG URL (replaced Exa API)
    this.searxngUrl = process.env.SEARXNG_URL || 'http://localhost:8080';

    // Mapbox API
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    // OpenWeatherMap API
    this.openWeatherKey = process.env.OPENWEATHER_API_KEY;

    // Exchange Rate API
    this.exchangeRateKey = process.env.EXCHANGE_RATE_API_KEY;

    // Amadeus API for flights
    this.amadeusClientId = process.env.AMADEUS_CLIENT_ID;
    this.amadeusClientSecret = process.env.AMADEUS_CLIENT_SECRET;
    this.amadeusToken = null;
    this.amadeusTokenExpiry = null;

    // Booking/RapidAPI for hotels
    this.rapidApiKey = process.env.RAPIDAPI_KEY;

    // Ticketmaster for events
    this.ticketmasterKey = process.env.TICKETMASTER_API_KEY;

    // YouTube Data API v3
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY;

    // Current user context for trip management
    this.currentUserId = null;

    // Current user profile for personalized planning
    this.currentUserProfile = null;

    // Initialize handlers
    this._initializeHandlers();
  }

  /**
   * Initialize all handlers with bound context
   */
  _initializeHandlers() {
    // Search handlers
    const searchHandlers = createSearchHandlers(this);
    this.webSearch = searchHandlers.webSearch;
    this.scrapeUrl = searchHandlers.scrapeUrl;
    this.searchPlaces = searchHandlers.searchPlaces;

    // Info handlers
    const infoHandlers = createInfoHandlers(this);
    this.getCurrentDatetime = infoHandlers.getCurrentDatetime;
    this.getWeather = infoHandlers.getWeather;
    this.calculateDistance = infoHandlers.calculateDistance;
    this.getExchangeRate = infoHandlers.getExchangeRate;
    this.getTravelTips = infoHandlers.getTravelTips;

    // Booking handlers
    const bookingHandlers = createBookingHandlers(this);
    this.searchFlights = bookingHandlers.searchFlights;
    this.searchHotels = bookingHandlers.searchHotels;
    this.getLocalEvents = bookingHandlers.getLocalEvents;

    // Planning handlers
    const planningHandlers = createPlanningHandlers(this);
    this.optimizeItinerary = planningHandlers.optimizeItinerary;
    this.createTripPlan = planningHandlers.createTripPlan;

    // Trip management handlers
    const tripHandlers = createTripManagementHandlers(this);
    this.getUserTrips = tripHandlers.getUserTrips;
    this.getTripDetail = tripHandlers.getTripDetail;
    this.updateTrip = tripHandlers.updateTrip;
    this.deleteTrip = tripHandlers.deleteTrip;
    this.addActivity = tripHandlers.addActivity;
    this.updateActivity = tripHandlers.updateActivity;
    this.deleteActivity = tripHandlers.deleteActivity;
    this.reorderActivities = tripHandlers.reorderActivities;
    this.applyDraftToTrip = tripHandlers.applyDraftToTrip;
    this.addDayToTrip = tripHandlers.addDayToTrip;
    this.updateDay = tripHandlers.updateDay;
    this.deleteDay = tripHandlers.deleteDay;

    // Social media handlers
    const socialMediaHandlers = createSocialMediaHandlers(this);
    this.searchSocialMedia = socialMediaHandlers.searchSocialMedia;
    this.searchYouTubeVideos = socialMediaHandlers.searchYouTubeVideos;
  }

  /**
   * Set user context for trip management operations
   * Must be called before executing trip management tools
   */
  setUserContext(userId) {
    this.currentUserId = userId;
  }

  /**
   * Set conversation context for draft creation
   * Must be called before executing tools that create drafts
   */
  setConversationContext(conversationId) {
    this.currentConversationId = conversationId;
  }

  /**
   * Set user profile for personalized planning
   * Used by optimize_itinerary to tailor results to user preferences
   */
  setUserProfile(profile) {
    this.currentUserProfile = profile;
  }

  /**
   * Execute a tool call with scoped context injection.
   * Sets userId, conversationId, and userProfile before execution.
   * Preferred over separate setUserContext/setConversationContext/setUserProfile calls
   * because it co-locates context setting with execution.
   *
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} context - { userId, conversationId, userProfile }
   * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
   */
  async executeWithContext(toolName, args, context = {}) {
    if (context.userId) this.currentUserId = context.userId;
    if (context.conversationId !== undefined) this.currentConversationId = context.conversationId;
    if (context.userProfile !== undefined) this.currentUserProfile = context.userProfile;
    return this.execute(toolName, args);
  }

  /**
   * Execute a tool call
   *
   * FLOW: Step 2 - Context Enrichment Tools
   *       Step 5 - Draft Storage (create_trip_plan)
   */
  async execute(toolName, args) {
    const handlers = {
      // Search & Info tools (Step 2: Context Enrichment)
      get_current_datetime: this.getCurrentDatetime,
      web_search: this.webSearch,
      scrape_url: this.scrapeUrl,
      search_places: this.searchPlaces,
      get_weather: this.getWeather,
      calculate_distance: this.calculateDistance,
      get_exchange_rate: this.getExchangeRate,
      search_flights: this.searchFlights,
      search_hotels: this.searchHotels,
      get_local_events: this.getLocalEvents,
      get_travel_tips: this.getTravelTips,
      // Planning tools
      optimize_itinerary: this.optimizeItinerary,
      create_trip_plan: this.createTripPlan,
      // Trip management tools (Step 7B: Modify)
      get_user_trips: this.getUserTrips,
      get_trip_detail: this.getTripDetail,
      update_trip: this.updateTrip,
      delete_trip: this.deleteTrip,
      add_activity: this.addActivity,
      update_activity: this.updateActivity,
      delete_activity: this.deleteActivity,
      reorder_activities: this.reorderActivities,
      apply_draft_to_trip: this.applyDraftToTrip,
      add_day_to_trip: this.addDayToTrip,
      update_day: this.updateDay,
      delete_day: this.deleteDay,
      // Social media tools
      search_social_media: this.searchSocialMedia,
      search_youtube_videos: this.searchYouTubeVideos,
    };

    const handler = handlers[toolName];
    if (!handler) {
      logger.error(`Unknown tool: ${toolName}`);
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    // Categorize tool for logging
    const step2Tools = ['search_places', 'scrape_url', 'get_weather', 'get_local_events', 'get_travel_tips', 'calculate_distance'];
    const step5Tools = ['create_trip_plan'];
    const step7bTools = ['add_activity', 'update_activity', 'delete_activity', 'reorder_activities', 'update_trip'];
    
    let stepLabel = '';
    if (step2Tools.includes(toolName)) stepLabel = '[STEP 2: Context]';
    else if (step5Tools.includes(toolName)) stepLabel = '[STEP 5: Draft]';
    else if (step7bTools.includes(toolName)) stepLabel = '[STEP 7B: Modify]';
    else stepLabel = '[TOOL]';

    const cacheable = isCacheable(toolName, args);
    let cacheKey;

    if (cacheable) {
      cacheKey = generateCacheKey(toolName, args);
      try {
        const cached = await cacheService.get(cacheKey);
        if (cached !== null) {
          logger.info(
            `[ToolCache] HIT: ${toolName} (${cacheKey.slice(0, 8)})`
          );
          return { success: true, data: cached, cached: true };
        }
        logger.info(`[ToolCache] MISS: ${toolName} - executing`);
      } catch (cacheErr) {
        logger.warn('[ToolCache] Read error, executing normally', {
          error: cacheErr.message,
        });
      }
    }

    try {
      logger.info(`${stepLabel} Executing: ${toolName}`);
      const startTime = Date.now();
      const result = await handler(args);
      const duration = Date.now() - startTime;

      // Handlers may return { success: false, error } without throwing.
      // Normalize this as a failed tool execution so callers don't get
      // misleading outer success=true envelopes.
      if (result?.success === false) {
        logger.warn(`${toolName} failed in ${duration}ms`, {
          error: result.error || 'Unknown tool error',
        });
        return {
          success: false,
          error: result.error || `${toolName} failed`,
          data: result,
        };
      }

      if (cacheable) {
        const ttl = TOOL_CACHE_TTL[toolName] ?? DEFAULT_CACHE_TTL;
        try {
          await cacheService.set(cacheKey, result, ttl);
          logger.info(
            `[ToolCache] SAVED: ${toolName} (TTL: ${ttl}s)`
          );
        } catch (cacheErr) {
          logger.warn('[ToolCache] Write error, result not cached', {
            error: cacheErr.message,
          });
        }
      }

      logger.info(`${toolName} completed in ${duration}ms`);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(`${toolName} failed:`, { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return [
      // Search & Info tools
      'get_current_datetime',
      'web_search',
      'scrape_url',
      'search_places',
      'get_weather',
      'calculate_distance',
      'get_exchange_rate',
      'search_flights',
      'search_hotels',
      'get_local_events',
      'get_travel_tips',
      'optimize_itinerary',
      'create_trip_plan',
      // Trip management tools
      'get_user_trips',
      'get_trip_detail',
      'update_trip',
      'delete_trip',
      'add_activity',
      'update_activity',
      'delete_activity',
      'reorder_activities',
      'apply_draft_to_trip',
      'add_day_to_trip',
      'update_day',
      'delete_day',
    ];
  }

  /**
   * Check if a tool requires authentication
   */
  toolRequiresAuth(toolName) {
    const authRequiredTools = [
      'get_user_trips',
      'get_trip_detail',
      'update_trip',
      'delete_trip',
      'add_activity',
      'update_activity',
      'delete_activity',
      'reorder_activities',
      'apply_draft_to_trip',
      'add_day_to_trip',
      'update_day',
      'delete_day',
    ];
    return authRequiredTools.includes(toolName);
  }
}

export default new ToolExecutor();
