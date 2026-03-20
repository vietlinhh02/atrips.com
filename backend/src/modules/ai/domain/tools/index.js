/**
 * AI Tools Index
 * Central export for all AI tool definitions
 */

import { SEARCH_TOOLS, SEARCH_TOOL_NAMES, SEARCH_TOOL_HANDLERS, GEMINI_GOOGLE_SEARCH_TOOL, TOOLS_REPLACED_BY_GEMINI_SEARCH } from './searchTools.js';
import { PLANNING_TOOLS, PLANNING_TOOL_NAMES, PLANNING_TOOL_HANDLERS } from './planningTools.js';
import { TRIP_MANAGEMENT_TOOLS, TRIP_MANAGEMENT_TOOL_NAMES, TRIP_MANAGEMENT_TOOL_HANDLERS } from './tripManagementTools.js';
import { SOCIAL_MEDIA_TOOLS, SOCIAL_MEDIA_TOOL_NAMES, SOCIAL_MEDIA_TOOL_HANDLERS } from './socialMediaTools.js';

/**
 * Check if Gemini native Google Search is enabled
 */
export function isGeminiSearchEnabled() {
  return process.env.GEMINI_SEARCH_ENABLED === 'true';
}

/**
 * Apply Gemini Search transform to tools array.
 * Gemini API không hỗ trợ google_search grounding + function calling
 * trong cùng 1 request. Khi Gemini Search enabled, chỉ gửi google_search.
 */
export function applyGeminiSearchTools() {
  return [GEMINI_GOOGLE_SEARCH_TOOL];
}

/**
 * All tool definitions combined
 */
export const TOOL_DEFINITIONS = [
  ...SEARCH_TOOLS,
  ...PLANNING_TOOLS,
  ...TRIP_MANAGEMENT_TOOLS,
  ...SOCIAL_MEDIA_TOOLS,
];

/**
 * All tool handlers combined
 */
export const TOOL_HANDLERS = {
  ...SEARCH_TOOL_HANDLERS,
  ...PLANNING_TOOL_HANDLERS,
  ...TRIP_MANAGEMENT_TOOL_HANDLERS,
  ...SOCIAL_MEDIA_TOOL_HANDLERS,
};

/**
 * Task type to tools mapping
 */
const TOOLS_BY_TASK = {
  // Itinerary generation
  itinerary: [
    'get_current_datetime',
    'web_search',
    'scrape_url',
    'search_places',
    'get_weather',
    'calculate_distance',
    'get_local_events',
    'optimize_itinerary',
    'create_trip_plan',
    'search_social_media',
    'search_youtube_videos',
  ],
  // Recommendations
  recommend: [
    'get_current_datetime',
    'web_search',
    'scrape_url',
    'search_places',
    'get_weather',
    'get_travel_tips',
    'search_social_media',
    'search_youtube_videos',
  ],
  // Budget estimation
  budget: [
    'get_current_datetime',
    'web_search',
    'scrape_url',
    'search_flights',
    'search_hotels',
    'get_exchange_rate',
  ],
  // Route optimization
  optimize: [
    'calculate_distance',
    'get_weather',
    'search_places',
    'optimize_itinerary',
  ],
  // Research & info
  research: [
    'get_current_datetime',
    'web_search',
    'scrape_url',
    'search_places',
    'get_weather',
    'get_travel_tips',
    'get_exchange_rate',
    'calculate_distance',
    'search_hotels',
    'search_flights',
    'search_social_media',
    'search_youtube_videos',
  ],
  // Full trip management
  trip_manage: [
    ...TRIP_MANAGEMENT_TOOL_NAMES,
  ],
  // Modify existing trip with AI assistance
  modify_trip: [
    'get_trip_detail',
    'update_trip',
    'add_activity',
    'update_activity',
    'delete_activity',
    'reorder_activities',
    'add_day_to_trip',
    'update_day',
    'delete_day',
    'web_search',
    'scrape_url',
    'search_places',
    'get_weather',
    'calculate_distance',
  ],
};

/**
 * Get tool definitions for specific use cases
 * @param {Object} context - Context object with taskType and/or enabledTools
 * @returns {Array} Array of tool definitions
 */
export function getToolsForContext(context = {}) {
  const { taskType, enabledTools } = context;

  // If specific tools are enabled, filter by them
  if (enabledTools && Array.isArray(enabledTools)) {
    return TOOL_DEFINITIONS.filter(tool =>
      enabledTools.includes(tool.function.name)
    );
  }

  // Return tools based on task type
  if (taskType && TOOLS_BY_TASK[taskType]) {
    return TOOL_DEFINITIONS.filter(tool =>
      TOOLS_BY_TASK[taskType].includes(tool.function.name)
    );
  }

  // Return all tools by default
  return TOOL_DEFINITIONS;
}

/**
 * Get tool names by category
 */
export function getToolNamesByCategory() {
  return {
    search: SEARCH_TOOL_NAMES,
    planning: PLANNING_TOOL_NAMES,
    tripManagement: TRIP_MANAGEMENT_TOOL_NAMES,
    socialMedia: SOCIAL_MEDIA_TOOL_NAMES,
  };
}

/**
 * Check if a tool requires authentication
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if tool requires auth
 */
export function toolRequiresAuth(toolName) {
  return TRIP_MANAGEMENT_TOOL_NAMES.includes(toolName);
}

/**
 * Get tools that require authentication
 * @returns {Array} Array of tool names
 */
export function getAuthRequiredTools() {
  return TRIP_MANAGEMENT_TOOL_NAMES;
}

// Re-export individual tool categories
export {
  SEARCH_TOOLS,
  SEARCH_TOOL_NAMES,
  SEARCH_TOOL_HANDLERS,
  PLANNING_TOOLS,
  PLANNING_TOOL_NAMES,
  PLANNING_TOOL_HANDLERS,
  TRIP_MANAGEMENT_TOOLS,
  TRIP_MANAGEMENT_TOOL_NAMES,
  TRIP_MANAGEMENT_TOOL_HANDLERS,
  SOCIAL_MEDIA_TOOLS,
  SOCIAL_MEDIA_TOOL_NAMES,
  SOCIAL_MEDIA_TOOL_HANDLERS,
};

export default {
  TOOL_DEFINITIONS,
  TOOL_HANDLERS,
  getToolsForContext,
  getToolNamesByCategory,
  toolRequiresAuth,
  getAuthRequiredTools,
  isGeminiSearchEnabled,
  applyGeminiSearchTools,
};
