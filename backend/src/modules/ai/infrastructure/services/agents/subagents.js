/**
 * Subagent Factories
 * Creates specialized ReAct agents for parallel task execution.
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import {
  SEARCH_AGENT_PROMPT,
  PLACE_AGENT_PROMPT,
  BUDGET_AGENT_PROMPT,
  BOOKING_AGENT_PROMPT,
  TRIP_MANAGE_AGENT_PROMPT,
  SYNTHESIZER_AGENT_PROMPT,
} from '../../../domain/prompts/index.js';

/**
 * Filter tools by name from the full tool set.
 */
function filterTools(allTools, names) {
  return allTools.filter(t => names.includes(t.name));
}

/**
 * Create a search-focused agent (web_search, scrape_url, social media, youtube).
 */
export function createSearchAgent(model, allTools) {
  const toolNames = [
    'web_search', 'scrape_url',
    'search_social_media', 'search_youtube_videos',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: SEARCH_AGENT_PROMPT,
  });
}

/**
 * Create a place/info agent (search_places, weather, distance, tips, events).
 */
export function createPlaceAgent(model, allTools) {
  const toolNames = [
    'search_places', 'get_weather', 'calculate_distance',
    'get_travel_tips', 'get_local_events', 'get_current_datetime',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: PLACE_AGENT_PROMPT,
  });
}

/**
 * Create a budget agent (exchange_rate, flights, hotels).
 */
export function createBudgetAgent(model, allTools) {
  const toolNames = [
    'get_exchange_rate', 'search_flights', 'search_hotels',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: BUDGET_AGENT_PROMPT,
  });
}

/**
 * Create a booking agent (flights, hotels, events).
 */
export function createBookingAgent(model, allTools) {
  const toolNames = [
    'search_flights', 'search_hotels', 'get_local_events',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: BOOKING_AGENT_PROMPT,
  });
}

/**
 * Create a trip management agent (CRUD operations).
 */
export function createTripManageAgent(model, allTools) {
  const toolNames = [
    'get_user_trips', 'get_trip_detail', 'update_trip', 'delete_trip',
    'add_activity', 'update_activity', 'delete_activity', 'reorder_activities',
    'apply_draft_to_trip', 'add_day_to_trip', 'update_day', 'delete_day',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: TRIP_MANAGE_AGENT_PROMPT,
  });
}

/**
 * Create a synthesizer agent (optimize_itinerary, create_trip_plan).
 */
export function createSynthesizerAgent(model, allTools) {
  const toolNames = [
    'optimize_itinerary', 'create_trip_plan',
  ];
  return createReactAgent({
    llm: model,
    tools: filterTools(allTools, toolNames),
    stateModifier: SYNTHESIZER_AGENT_PROMPT,
  });
}
