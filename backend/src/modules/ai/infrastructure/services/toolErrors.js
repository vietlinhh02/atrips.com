/**
 * Structured Tool Errors
 * Canonical error codes and ToolError class for AI tool execution.
 * Inspired by reference implementation's error handling pattern.
 */

// Error codes organized by domain
const SEARCH_ERROR_CODES = {
  webSearchFailed: 'web_search_failed',
  webSearchRateLimited: 'web_search_rate_limited',
  scrapeUrlFailed: 'scrape_url_failed',
  scrapeUrlRateLimited: 'scrape_url_rate_limited',
  searchPlacesFailed: 'search_places_failed',
  searchPlacesRateLimited: 'search_places_rate_limited',
};

const INFO_ERROR_CODES = {
  weatherFailed: 'weather_failed',
  distanceFailed: 'distance_failed',
  exchangeRateFailed: 'exchange_rate_failed',
  travelTipsFailed: 'travel_tips_failed',
};

const BOOKING_ERROR_CODES = {
  flightSearchFailed: 'flight_search_failed',
  flightSearchRateLimited: 'flight_search_rate_limited',
  hotelSearchFailed: 'hotel_search_failed',
  hotelSearchRateLimited: 'hotel_search_rate_limited',
  eventSearchFailed: 'event_search_failed',
};

const PLANNING_ERROR_CODES = {
  optimizeItineraryFailed: 'optimize_itinerary_failed',
  optimizeItineraryRateLimited: 'optimize_itinerary_rate_limited',
  createTripPlanFailed: 'create_trip_plan_failed',
  createTripPlanRateLimited: 'create_trip_plan_rate_limited',
};

const TRIP_ERROR_CODES = {
  tripOperationFailed: 'trip_operation_failed',
  tripNotFound: 'trip_not_found',
  tripUnauthorized: 'trip_unauthorized',
};

const SOCIAL_ERROR_CODES = {
  socialMediaSearchFailed: 'social_media_search_failed',
  socialMediaSearchRateLimited: 'social_media_search_rate_limited',
  youtubeSearchFailed: 'youtube_search_failed',
  youtubeSearchRateLimited: 'youtube_search_rate_limited',
};

const GENERAL_ERROR_CODES = {
  unknownTool: 'unknown_tool',
  invalidInput: 'invalid_input',
  invalidOutput: 'invalid_output',
  rateLimited: 'rate_limited',
  toolExecutionFailed: 'tool_execution_failed',
};

export const TOOL_ERROR_CODES = {
  ...SEARCH_ERROR_CODES,
  ...INFO_ERROR_CODES,
  ...BOOKING_ERROR_CODES,
  ...PLANNING_ERROR_CODES,
  ...TRIP_ERROR_CODES,
  ...SOCIAL_ERROR_CODES,
  ...GENERAL_ERROR_CODES,
};

/**
 * Structured tool error with machine-readable code and optional metadata.
 */
export class ToolError extends Error {
  /**
   * @param {string} code - Error code from TOOL_ERROR_CODES
   * @param {string} [message] - Human-readable message (defaults to code)
   * @param {Record<string, unknown>} [meta] - Optional metadata for debugging
   */
  constructor(code, message, meta) {
    super(message || code);
    this.name = 'ToolError';
    this.code = code;
    this.meta = meta || {};
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      meta: this.meta,
    };
  }
}

/**
 * Create a ToolError instance.
 * @param {string} code - Error code from TOOL_ERROR_CODES
 * @param {string} [message] - Optional message
 * @param {Record<string, unknown>} [meta] - Optional metadata
 * @returns {ToolError}
 */
export function createToolError(code, message, meta) {
  return new ToolError(code, message, meta);
}

/**
 * Check if an error is a ToolError.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isToolError(err) {
  return err instanceof ToolError;
}
