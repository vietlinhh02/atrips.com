/**
 * Trip Management Tools
 * Tools for managing trips, days, and activities (CRUD operations)
 * All tools in this file require user authentication.
 */

export const TRIP_MANAGEMENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_user_trips',
      description: 'Get the list of user\'s trips. Use when the user asks about their existing trips, wants to review past trips, or needs to reference a previous trip.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
            description: 'Filter by trip status (optional)',
          },
          limit: {
            type: 'number',
            description: 'Maximum trips to return. Default: 10.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trip_detail',
      description: 'Get full details of a specific trip including day-by-day schedule and all activities. Use when the user wants to view or modify an existing trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID to retrieve',
          },
        },
        required: ['tripId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_trip',
      description: 'Update trip metadata — title, description, dates, travelers count, budget, status, or visibility. Use when the user wants to change trip-level information.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID to update',
          },
          title: {
            type: 'string',
            description: 'New title (1-200 characters)',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          startDate: {
            type: 'string',
            description: 'New start date (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'New end date (YYYY-MM-DD)',
          },
          travelersCount: {
            type: 'number',
            description: 'Number of travelers',
          },
          budgetTotal: {
            type: 'number',
            description: 'Total budget amount',
          },
          budgetCurrency: {
            type: 'string',
            description: 'Budget currency (VND, USD, EUR, etc.)',
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
            description: 'Trip status',
          },
          visibility: {
            type: 'string',
            enum: ['PRIVATE', 'SHARED', 'PUBLIC'],
            description: 'Trip visibility',
          },
        },
        required: ['tripId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_trip',
      description: 'Permanently delete a trip. WARNING: This action is irreversible. Always confirm with the user before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID to delete',
          },
          confirm: {
            type: 'boolean',
            description: 'Must be true to confirm deletion',
          },
        },
        required: ['tripId', 'confirm'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_activity',
      description: 'Add a new activity to a specific day in a trip. Use when the user wants to add a place, restaurant, or activity to their itinerary.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          dayId: {
            type: 'string',
            description: 'Day ID to add the activity to',
          },
          name: {
            type: 'string',
            description: 'Activity name (1-200 characters)',
          },
          type: {
            type: 'string',
            enum: ['ATTRACTION', 'DINING', 'ACCOMMODATION', 'TRANSPORTATION', 'ACTIVITY', 'SHOPPING', 'OTHER'],
            description: 'Activity type',
          },
          description: {
            type: 'string',
            description: 'Detailed description',
          },
          startTime: {
            type: 'string',
            description: 'Start time (HH:mm)',
          },
          endTime: {
            type: 'string',
            description: 'End time (HH:mm)',
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes',
          },
          address: {
            type: 'string',
            description: 'Venue address',
          },
          latitude: {
            type: 'number',
            description: 'Latitude coordinate',
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate',
          },
          estimatedCost: {
            type: 'number',
            description: 'Estimated cost',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
        },
        required: ['tripId', 'dayId', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_activity',
      description: 'Update an existing activity\'s details — time, location, cost, or other fields. Use when the user wants to modify a specific activity in their trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          activityId: {
            type: 'string',
            description: 'Activity ID to update',
          },
          name: {
            type: 'string',
            description: 'New name',
          },
          type: {
            type: 'string',
            enum: ['ATTRACTION', 'DINING', 'ACCOMMODATION', 'TRANSPORTATION', 'ACTIVITY', 'SHOPPING', 'OTHER'],
            description: 'New activity type',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          startTime: {
            type: 'string',
            description: 'New start time (HH:mm)',
          },
          endTime: {
            type: 'string',
            description: 'New end time (HH:mm)',
          },
          duration: {
            type: 'number',
            description: 'New duration in minutes',
          },
          address: {
            type: 'string',
            description: 'New address',
          },
          latitude: {
            type: 'number',
            description: 'New latitude',
          },
          longitude: {
            type: 'number',
            description: 'New longitude',
          },
          estimatedCost: {
            type: 'number',
            description: 'New estimated cost',
          },
          notes: {
            type: 'string',
            description: 'New notes',
          },
        },
        required: ['tripId', 'activityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_activity',
      description: 'Remove an activity from the itinerary. Use when the user wants to drop an activity from their trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          activityId: {
            type: 'string',
            description: 'Activity ID to delete',
          },
        },
        required: ['tripId', 'activityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorder_activities',
      description: 'Rearrange the order of activities within a day. Use when the user wants to change the sequence of their daily activities.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          dayId: {
            type: 'string',
            description: 'Day ID to reorder',
          },
          activityIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Activity IDs in the desired new order',
          },
        },
        required: ['tripId', 'dayId', 'activityIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_draft_to_trip',
      description: 'Convert an AI-generated draft into an actual trip. Use when the user confirms they want to create a trip from the AI-generated itinerary.',
      parameters: {
        type: 'object',
        properties: {
          draftId: {
            type: 'string',
            description: 'Draft ID to apply',
          },
          createNew: {
            type: 'boolean',
            description: 'true = create a new trip, false = update an existing trip. Default: true.',
          },
          existingTripId: {
            type: 'string',
            description: 'Existing trip ID to update (only when createNew = false)',
          },
        },
        required: ['draftId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_day_to_trip',
      description: 'Add a new day to a trip. Use when the user wants to extend their trip or add a free day.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          date: {
            type: 'string',
            description: 'Date to add (YYYY-MM-DD)',
          },
          title: {
            type: 'string',
            description: 'Day title (e.g., "Day 6: Free day")',
          },
          notes: {
            type: 'string',
            description: 'Day notes',
          },
        },
        required: ['tripId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_day',
      description: 'Update a day\'s metadata — title, notes, or date. Use when the user wants to change day-level information.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          dayId: {
            type: 'string',
            description: 'Day ID to update',
          },
          title: {
            type: 'string',
            description: 'New title',
          },
          notes: {
            type: 'string',
            description: 'New notes',
          },
          date: {
            type: 'string',
            description: 'New date (YYYY-MM-DD)',
          },
        },
        required: ['tripId', 'dayId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_day',
      description: 'Delete a day from a trip, including all activities within that day. Use when the user wants to shorten their trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Trip ID',
          },
          dayId: {
            type: 'string',
            description: 'Day ID to delete',
          },
        },
        required: ['tripId', 'dayId'],
      },
    },
  },
];

/**
 * Trip management tool names for easy reference
 */
export const TRIP_MANAGEMENT_TOOL_NAMES = TRIP_MANAGEMENT_TOOLS.map(t => t.function.name);

/**
 * Trip management tool handlers mapping
 */
export const TRIP_MANAGEMENT_TOOL_HANDLERS = {
  get_user_trips: 'handleGetUserTrips',
  get_trip_detail: 'handleGetTripDetail',
  update_trip: 'handleUpdateTrip',
  delete_trip: 'handleDeleteTrip',
  add_activity: 'handleAddActivity',
  update_activity: 'handleUpdateActivity',
  delete_activity: 'handleDeleteActivity',
  reorder_activities: 'handleReorderActivities',
  apply_draft_to_trip: 'handleApplyDraftToTrip',
  add_day_to_trip: 'handleAddDayToTrip',
  update_day: 'handleUpdateDay',
  delete_day: 'handleDeleteDay',
};
