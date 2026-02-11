/**
 * Planning Tools
 * Tools for creating trip plans and drafts
 */

export const PLANNING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'optimize_itinerary',
      description: 'Clusters places by proximity into days, then optimizes visit order via TSP to minimize travel distance. Returns ALL available places in route-optimized order per day as a places[] array. Does NOT assign times or schedule meals — AI creates the full schedule. Also returns "googleMapsData" with: name, rating, ratingCount, address, openingHours, phone, photoUrl, reviewSnippet, description, priceLevel, rawText (up to 2000 chars), and for top places an "enrichedDetail" block with: rawAbout (full description), rawReviews (multiple user reviews separated by ---), rawHours (per-day opening hours), rawAmenities, rawServiceOptions, allPhotoUrls (up to 5 high-res photos), fullAddress, businessWebsite, menuUrl. MANDATORY: After calling this tool, you MUST (1) create a COMPLETE time schedule with specific times, meal breaks, and travel segments — use the places[] array as your pool, select which to include per day, assign times, and add meals, (2) use googleMapsData (especially enrichedDetail) for authentic review quotes, specific per-day hours, amenities, and practical tips, and (3) call create_trip_plan in the SAME response to save it. Pass googleMapsInfo per activity in create_trip_plan so data persists in the draft. Never fabricate place details — use the real data from the result.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'Trip destination (city or region name)',
          },
          startDate: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)',
          },
          budget: {
            type: 'number',
            description: 'Total trip budget in VND (optional)',
          },
          interests: {
            type: 'array',
            items: { type: 'string' },
            description: 'User interests (e.g., ["food", "culture", "beach"])',
          },
          travelStyle: {
            type: 'string',
            enum: ['budget', 'comfort', 'luxury', 'adventure', 'cultural'],
            description: 'Travel style preference. Default: "comfort"',
          },
          travelers: {
            type: 'number',
            description: 'Number of travelers. Default: 1',
          },
          hotelLocation: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
            },
            description: 'Hotel coordinates for route optimization (optional)',
          },
          mustSeeAttractions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Must-visit places by name (optional)',
          },
        },
        required: ['destination', 'startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_trip_plan',
      description: 'Automatically create and save a comprehensive trip plan draft to the database. MUST call this tool immediately after generating a detailed itinerary — do NOT wait for user confirmation. The draft is saved silently so the user can review, edit, or apply it to an actual trip later. NEVER announce or confirm the draft creation in your response. Include ALL Phase 1 features: overview, transportation details, booking suggestions, budget breakdown, and travel tips.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Trip title (e.g., "7-Day Germany Adventure", "Munich & Berlin Exploration")',
          },
          destination: {
            type: 'string',
            description: 'Primary destination of the trip',
          },
          description: {
            type: 'string',
            description: 'Brief trip description (optional)',
          },
          startDate: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD). Can be omitted if unknown.',
          },
          endDate: {
            type: 'string',
            description: 'End date (YYYY-MM-DD). Can be omitted if unknown.',
          },
          travelersCount: {
            type: 'number',
            description: 'Number of travelers. Default: 1.',
          },
          overview: {
            type: 'object',
            description: 'Trip overview: { summary: string (1-2 paragraphs), highlights: string[] (3-5 key highlights), weather: { avgTemp, condition, season }, culturalNotes: string, bestTimeToVisit: string }',
          },
          travelTips: {
            type: 'object',
            description: 'Travel tips by category: { general: string[], transportation: string[], food: string[], safety: string[], budget: string[] }',
          },
          budgetBreakdown: {
            type: 'object',
            description: 'Budget breakdown by category: { accommodation: { total, perDay }, food: { total, perDay }, transportation: { total, perDay }, activities: { total, perDay }, miscellaneous: { total, perDay } }',
          },
          itineraryData: {
            type: 'object',
            description: 'REQUIRED: Full itinerary data in JSON format: { days: [{ dayNumber, date, theme, activities: [{ time, title, description, location, duration, estimatedCost, type, tips, transportFromPrevious: { distance, duration, mode, cost, instructions }, googleMapsInfo: { rating, ratingCount, openingHours, reviewQuote, amenities, photos } }], meals, dailyCost, totalDistance, totalTravelTime }], totalEstimatedCost, currency, tips }',
          },
          bookingSuggestions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Booking suggestions: [{ type: "HOTEL|FLIGHT|TOUR", title, provider, estimatedCost, bookingUrl, checkIn, checkOut, notes }]',
          },
        },
        required: ['title', 'destination', 'itineraryData'],
      },
    },
  },
];

/**
 * Planning tool names for easy reference
 */
export const PLANNING_TOOL_NAMES = PLANNING_TOOLS.map(t => t.function.name);

/**
 * Planning tool handlers mapping
 */
export const PLANNING_TOOL_HANDLERS = {
  optimize_itinerary: 'handleOptimizeItinerary',
  create_trip_plan: 'handleCreateTripPlan',
};
