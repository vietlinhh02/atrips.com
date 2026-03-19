/**
 * Search & Information Tools
 * Tools for searching places, weather, flights, hotels, etc.
 *
 * Tool description pattern: Clear English descriptions with explicit usage guidance.
 * Parameter descriptions include defaults and constraints for better AI tool selection.
 */

export const SEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description: 'Get the current date, time, and day of week. Automatically uses the user\'s timezone from their profile. CRITICAL: Must call this tool FIRST whenever the user mentions relative dates like "next Saturday", "this weekend", "next month", "tomorrow", etc. to calculate exact dates before proceeding.',
      parameters: {
        type: 'object',
        properties: {
          calculate_relative_date: {
            type: 'string',
            description: 'Calculate a relative date from today. Examples: "next_saturday", "next_sunday", "next_week", "next_month", "+7_days", "+2_weeks"',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for the latest information. Returns results from the past 6 months by default, sorted by newest first. DO NOT append past years (like 2024 or 2025) to your query. Use for: reviews, travel tips, prices, events, news. Results contain short snippets only — follow up with scrape_url for full details.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "best restaurants in Da Lat 2026", "Hanoi to Da Nang flight prices")',
          },
          type: {
            type: 'string',
            enum: ['auto', 'keyword', 'neural'],
            description: 'Search type: auto (default — smart routing), keyword (exact match), neural (semantic understanding)',
          },
          numResults: {
            type: 'number',
            description: 'Number of results to return. Default: 3. Max: 8. Keep low to save API quota.',
          },
          recency: {
            type: 'string',
            enum: ['week', 'month', '3months', '6months', 'year', 'all'],
            description: 'Time filter. Default: 6months. Use week/month for urgent events. Use year/all as fallback only.',
          },
          sortBy: {
            type: 'string',
            enum: ['date', 'relevance'],
            description: 'Sort order. Default: date (newest first). Only use relevance when user explicitly wants "most relevant".',
          },
          includeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only search within these domains (e.g., ["tripadvisor.com", "foody.vn", "booking.com"])',
          },
          excludeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exclude these domains from results',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scrape_url',
      description: 'Crawl a specific URL to extract its full content. MUST use after web_search, search_flights, or search_hotels when you need detailed information (restaurant names, addresses, exact prices, full reviews, schedules). Search results only contain brief snippets — this tool gets the complete page content.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to crawl (obtained from prior search results)',
          },
          maxLength: {
            type: 'number',
            description: 'Maximum characters to extract. Default: 5000. Max: 8000.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: 'Search for specific venues — restaurants, hotels, attractions, cafes, shopping, entertainment — at a given location. DO NOT append past years to your query. Returns structured data including coordinates, ratings, and addresses. Results prioritized by recent updates and ratings.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords (e.g., "scenic cafe", "seafood restaurant", "museum")',
          },
          location: {
            type: 'string',
            description: 'City or area to search in (e.g., "Da Lat", "District 1, Ho Chi Minh City")',
          },
          type: {
            type: 'string',
            enum: ['restaurant', 'hotel', 'attraction', 'cafe', 'shopping', 'entertainment'],
            description: 'Venue type filter',
          },
          limit: {
            type: 'number',
            description: 'Maximum results. Default: 3. Max: 8.',
          },
          sortBy: {
            type: 'string',
            enum: ['rating', 'recent', 'distance', 'relevance'],
            description: 'Sort order. Default: recent (latest updates). Use rating for "best rated" requests.',
          },
          recency: {
            type: 'string',
            enum: ['week', 'month', '3months', '6months', 'year', 'all'],
            description: 'Filter by update freshness. Default: 3months.',
          },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather conditions or forecast for a location. Useful for trip planning, activity suggestions, and packing advice.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or location name',
          },
          date: {
            type: 'string',
            description: 'Date for forecast (YYYY-MM-DD). Omit for current weather.',
          },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_distance',
      description: 'Calculate distance and estimated travel time between two locations. Supports driving, walking, transit, and bicycling modes. CRITICAL: Use this tool to verify if travel between distant cities (e.g., Munich to Berlin) is feasible within a single day before adding it to an itinerary.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: 'Starting point (address or place name)',
          },
          destination: {
            type: 'string',
            description: 'End point (address or place name)',
          },
          mode: {
            type: 'string',
            enum: ['driving', 'walking', 'transit', 'bicycling'],
            description: 'Travel mode. Default: driving.',
          },
        },
        required: ['origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exchange_rate',
      description: 'Get real-time currency exchange rates. Use for international trip budgeting and cost conversions.',
      parameters: {
        type: 'object',
        properties: {
          from_currency: {
            type: 'string',
            description: 'Source currency code (e.g., USD, EUR, JPY)',
          },
          to_currency: {
            type: 'string',
            description: 'Target currency code (e.g., VND)',
          },
          amount: {
            type: 'number',
            description: 'Amount to convert. Default: 1.',
          },
        },
        required: ['from_currency', 'to_currency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_flights',
      description: 'Search for flights between cities. Results sorted by lowest price by default. Note: results may contain only brief snippets — use scrape_url on result URLs for detailed pricing, schedules, and booking options.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: 'Departure city or airport',
          },
          destination: {
            type: 'string',
            description: 'Arrival city or airport',
          },
          departure_date: {
            type: 'string',
            description: 'Departure date (YYYY-MM-DD)',
          },
          return_date: {
            type: 'string',
            description: 'Return date (YYYY-MM-DD). Omit for one-way.',
          },
          passengers: {
            type: 'number',
            description: 'Number of passengers. Default: 1.',
          },
          limit: {
            type: 'number',
            description: 'Maximum results. Default: 3. Max: 8.',
          },
          sortBy: {
            type: 'string',
            enum: ['price', 'duration', 'departure_time'],
            description: 'Sort order. Default: price (lowest first).',
          },
        },
        required: ['origin', 'destination', 'departure_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_hotels',
      description: 'Search for hotels and accommodation at a location. Results sorted by highest rating by default. Note: results may contain only brief snippets — use scrape_url on result URLs for room rates, amenities, and detailed reviews.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or area',
          },
          check_in: {
            type: 'string',
            description: 'Check-in date (YYYY-MM-DD)',
          },
          check_out: {
            type: 'string',
            description: 'Check-out date (YYYY-MM-DD)',
          },
          guests: {
            type: 'number',
            description: 'Number of guests. Default: 2.',
          },
          budget: {
            type: 'string',
            enum: ['budget', 'mid-range', 'luxury'],
            description: 'Price tier filter',
          },
          limit: {
            type: 'number',
            description: 'Maximum results. Default: 3. Max: 8.',
          },
          sortBy: {
            type: 'string',
            enum: ['rating', 'price_low', 'price_high', 'distance'],
            description: 'Sort order. Default: rating (highest first).',
          },
        },
        required: ['location', 'check_in', 'check_out'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_local_events',
      description: 'Find local events, festivals, concerts, and activities happening at a location. Results sorted by upcoming date by default.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or area',
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD)',
          },
          category: {
            type: 'string',
            enum: ['music', 'food', 'culture', 'sports', 'art', 'festival'],
            description: 'Event category filter',
          },
          limit: {
            type: 'number',
            description: 'Maximum results. Default: 5. Max: 10.',
          },
          sortBy: {
            type: 'string',
            enum: ['date_upcoming', 'popularity', 'relevance'],
            description: 'Sort order. Default: date_upcoming (soonest first).',
          },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_travel_tips',
      description: 'Get practical travel tips and advice for a destination. Covers safety, culture, food customs, transportation, money, weather, and packing.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'Destination to get tips for',
          },
          topics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['safety', 'culture', 'food', 'transport', 'money', 'weather', 'packing'],
            },
            description: 'Specific topics to cover',
          },
        },
        required: ['destination'],
      },
    },
  },
];

/**
 * Search tool names for easy reference
 */
export const SEARCH_TOOL_NAMES = SEARCH_TOOLS.map(t => t.function.name);

/**
 * Gemini native Google Search grounding tool
 * Sent as-is to the AI proxy when GEMINI_SEARCH_ENABLED=true
 */
export const GEMINI_GOOGLE_SEARCH_TOOL = {
  type: 'google_search',
  google_search: {},
};

/**
 * Tools replaced by Gemini native search (removed when Gemini search is enabled)
 */
export const TOOLS_REPLACED_BY_GEMINI_SEARCH = [];

/**
 * Search tool handlers mapping
 */
export const SEARCH_TOOL_HANDLERS = {
  get_current_datetime: 'handleGetCurrentDatetime',
  web_search: 'handleWebSearch',
  scrape_url: 'handleScrapeUrl',
  search_places: 'handleSearchPlaces',
  get_weather: 'handleGetWeather',
  calculate_distance: 'handleCalculateDistance',
  get_exchange_rate: 'handleGetExchangeRate',
  search_flights: 'handleSearchFlights',
  search_hotels: 'handleSearchHotels',
  get_local_events: 'handleGetLocalEvents',
  get_travel_tips: 'handleGetTravelTips',
};
