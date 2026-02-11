/**
 * Trip Planner Service
 * Simplified pipeline: TSP-only route optimization
 *
 * Pipeline:
 * 1. Filter places by destination
 * 2. Cluster places by day (proximity-based)
 * 3. TSP route optimization per day
 * 4. Output places in route-optimized order (AI handles scheduling)
 */

import { solveTSP, haversineDistance } from './TSPSolver.js';
import { logger } from '../../../../shared/services/LoggerService.js';

/**
 * Calculate number of days from date range
 */
function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(1, diffDays + 1); // Include both start and end day
}

/**
 * Estimate budget per day by style
 */
function estimateDailyBudget(travelStyle, destination) {
  // Base budgets in VND
  const baseBudgets = {
    budget: 500000,      // ~500k VND
    comfort: 1500000,    // ~1.5M VND
    luxury: 5000000,     // ~5M VND
    adventure: 1000000,  // ~1M VND
    cultural: 800000,    // ~800k VND
  };

  // Destination multipliers (simplified)
  const destinationMultipliers = {
    'hà nội': 1.0,
    'tp.hcm': 1.1,
    'đà nẵng': 0.9,
    'đà lạt': 0.8,
    'nha trang': 0.9,
    'phú quốc': 1.2,
    'sapa': 0.85,
    'hội an': 0.85,
    default: 1.0,
  };

  const base = baseBudgets[travelStyle] || baseBudgets.comfort;
  const destLower = destination?.toLowerCase() || '';

  let multiplier = destinationMultipliers.default;
  for (const [key, value] of Object.entries(destinationMultipliers)) {
    if (destLower.includes(key)) {
      multiplier = value;
      break;
    }
  }

  return Math.round(base * multiplier);
}

/**
 * Main Trip Planning Pipeline
 */
export class TripPlanner {
  constructor(options = {}) {
    this.options = {
      enableCaching: true,
      useAIEnhancement: false,
      ...options,
    };
  }

  /**
   * Generate a complete trip itinerary
   * @param {Object} params - Trip parameters
   * @param {Array} availablePlaces - POI database
   * @returns {Object} Complete itinerary
   */
  async generateItinerary(params, availablePlaces) {
    const {
      destination,
      startDate,
      endDate,
      budget = null,
      interests = [],
      travelStyle = 'comfort',
      travelers = 1,
      hotelLocation = null,
      mustSeeAttractions = [],
      avoidTypes = [],
    } = params;

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │           TRIP PLANNER PIPELINE STARTED                 │');
    logger.info('  └─────────────────────────────────────────────────────────┘');

    // Step 1: Calculate trip parameters
    const numDays = calculateDays(startDate, endDate);
    const dailyMoneyBudget = budget
      ? Math.round(budget / numDays)
      : estimateDailyBudget(travelStyle, destination);

    logger.info('  Trip Parameters:');
    logger.info(`     - Destination: ${destination}`);
    logger.info(`     - Duration: ${numDays} days`);
    logger.info(`     - Daily money budget: ${dailyMoneyBudget.toLocaleString()} VND`);
    logger.info(`     - Travel style: ${travelStyle}`);
    logger.info(`     - Travelers: ${travelers}`);

    // Step 2: Filter places for destination
    logger.info(`  [Step 1/3] Filtering places for destination...`);
    let destinationPlaces = this.filterByDestination(availablePlaces, destination);
    logger.info(`     - Found ${destinationPlaces.length} places in ${destination}`);

    // Soft fallback: if destination filter is too strict, use all places
    // (they've already been radius-filtered in planningHandlers)
    if (destinationPlaces.length < 5 && availablePlaces.length > destinationPlaces.length) {
      logger.info(`     - Destination filter too strict (${destinationPlaces.length}/${availablePlaces.length}), using all radius-filtered places`);
      destinationPlaces = availablePlaces;
    }

    // Filter out avoided types
    let filteredPlaces = destinationPlaces;
    if (avoidTypes.length > 0) {
      filteredPlaces = destinationPlaces.filter(p => !avoidTypes.includes(p.type));
      logger.info(`     - After excluding ${avoidTypes.join(', ')}: ${filteredPlaces.length} places`);
    }

    // Add must-see attractions with high priority
    const allPlaces = this.addMustSeeAttractions(
      filteredPlaces,
      mustSeeAttractions,
      destinationPlaces
    );
    if (mustSeeAttractions.length > 0) {
      logger.info(`     - Added ${mustSeeAttractions.length} must-see attractions`);
    }

    logger.info(`     - Total places for planning: ${allPlaces.length}`);

    // Step 3: Cluster places by day and optimize routes via TSP
    logger.info(`  [Step 2/3] Clustering places into ${numDays} days by proximity...`);
    const dayPlans = await this.organizeDays(allPlaces, numDays, {
      hotelLocation,
      travelStyle,
    });
    logger.info(`     - Clustered ${allPlaces.length} places across ${dayPlans.length} days`);

    // Step 4: Format final itinerary
    logger.info(`  [Step 3/3] TSP Route Optimization...`);
    for (const day of dayPlans) {
      logger.info(`     - Day ${day.day}: ${day.route.length} places, ${Math.round(day.totalDistance * 10) / 10} km`);
    }

    logger.info('  Formatting final itinerary...');
    const itinerary = this.formatItinerary({
      destination,
      startDate,
      endDate,
      numDays,
      travelStyle,
      travelers,
      budget,
      dailyBudget: dailyMoneyBudget,
      days: dayPlans,
    });

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │           TRIP PLANNER PIPELINE COMPLETE                │');
    logger.info('  └─────────────────────────────────────────────────────────┘');

    return itinerary;
  }

  /**
   * Filter places by destination
   */
  filterByDestination(places, destination) {
    const destLower = destination.toLowerCase();

    return places.filter(place => {
      const placeLocation = [
        place.city,
        place.address,
        place.region,
      ].filter(Boolean).join(' ').toLowerCase();

      return placeLocation.includes(destLower);
    });
  }

  /**
   * Add must-see attractions to the list
   */
  addMustSeeAttractions(places, mustSeeNames, allPlaces) {
    const result = [...places];
    const existingNames = new Set(places.map(p => p.name.toLowerCase()));

    for (const name of mustSeeNames) {
      if (existingNames.has(name.toLowerCase())) continue;

      // Find in all places
      const found = allPlaces.find(p =>
        p.name.toLowerCase().includes(name.toLowerCase())
      );

      if (found) {
        result.unshift({
          ...found,
          mustSee: true,
        });
      }
    }

    return result;
  }

  /**
   * Organize places by days with route optimization
   * Takes all places directly (no knapsack pre-selection)
   */
  async organizeDays(places, numDays, options) {
    const { hotelLocation, travelStyle } = options;

    if (places.length === 0) {
      return Array(numDays).fill(null).map((_, i) => ({
        day: i + 1,
        places: [],
        route: [],
        totalDistance: 0,
      }));
    }

    // Group by days using proximity clustering
    const dayGroups = this.clusterPlacesByDay(places, numDays, hotelLocation);

    // Optimize route for each day
    const optimizedDays = [];

    for (let i = 0; i < numDays; i++) {
      const dayPlaces = dayGroups[i] || [];

      if (dayPlaces.length < 2) {
        optimizedDays.push({
          day: i + 1,
          places: dayPlaces,
          route: dayPlaces,
          totalDistance: 0,
        });
        continue;
      }

      // Add hotel as starting point if provided
      let placesWithStart = dayPlaces;
      if (hotelLocation && hotelLocation.latitude && hotelLocation.longitude) {
        placesWithStart = [
          { ...hotelLocation, name: 'Hotel', type: 'START' },
          ...dayPlaces,
        ];
      }

      // Choose TSP algorithm based on travel style
      const tspAlgorithm = travelStyle === 'luxury' ? 'nearest_neighbor' : 'two_opt';

      // Solve TSP with style-appropriate algorithm
      const tspResult = solveTSP(placesWithStart, { algorithm: tspAlgorithm });

      // Remove hotel from route for display
      const routePlaces = tspResult.route.filter(p => p.type !== 'START');

      optimizedDays.push({
        day: i + 1,
        places: dayPlaces,
        route: routePlaces,
        totalDistance: tspResult.totalDistance,
        algorithm: tspResult.algorithm,
      });
    }

    return optimizedDays;
  }

  /**
   * Cluster places into days based on proximity
   */
  clusterPlacesByDay(places, numDays, hotelLocation) {
    if (places.length <= numDays) {
      // One place per day
      return places.map(p => [p]);
    }

    // K-means like clustering
    const groups = Array(numDays).fill(null).map(() => []);
    const avgPerDay = Math.ceil(places.length / numDays);

    // Sort places by distance from hotel (if available) or center
    const centerLat = hotelLocation?.latitude ||
      places.reduce((sum, p) => sum + (p.latitude || 0), 0) / places.length;
    const centerLng = hotelLocation?.longitude ||
      places.reduce((sum, p) => sum + (p.longitude || 0), 0) / places.length;

    const sortedPlaces = [...places].sort((a, b) => {
      const distA = haversineDistance(
        { lat: centerLat, lng: centerLng },
        { lat: a.latitude || centerLat, lng: a.longitude || centerLng }
      );
      const distB = haversineDistance(
        { lat: centerLat, lng: centerLng },
        { lat: b.latitude || centerLat, lng: b.longitude || centerLng }
      );
      return distA - distB;
    });

    // Distribute places across days
    // Day 1: nearby places, later days: farther places
    for (let i = 0; i < sortedPlaces.length; i++) {
      const dayIndex = Math.min(Math.floor(i / avgPerDay), numDays - 1);
      groups[dayIndex].push(sortedPlaces[i]);
    }

    // Balance groups if needed
    for (let i = 0; i < numDays - 1; i++) {
      while (groups[i].length > avgPerDay + 1 && groups[i + 1].length < avgPerDay) {
        const place = groups[i].pop();
        groups[i + 1].unshift(place);
      }
    }

    return groups;
  }

  /**
   * Format final itinerary output
   * Outputs places per day in route-optimized order (no time schedule)
   */
  formatItinerary(data) {
    const {
      destination,
      startDate,
      endDate,
      numDays,
      travelStyle,
      travelers,
      budget,
      dailyBudget,
      days,
    } = data;

    // Calculate totals
    const totalDistance = days.reduce((sum, d) => sum + (d.totalDistance || 0), 0);
    const totalPlaces = days.reduce((sum, d) => sum + d.route.length, 0);

    // Build day-by-day itinerary
    const itineraryDays = days.map((day, index) => {
      const date = startDate
        ? new Date(new Date(startDate).getTime() + index * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]
        : null;

      // Detect theme from place types
      const theme = this.detectDayTheme(day.route);

      return {
        dayNumber: index + 1,
        date,
        theme,
        places: day.route.map(place => ({
          name: place.name,
          type: place.type,
          address: place.address || null,
          rating: place.rating || null,
          ratingCount: place.ratingCount || null,
          phone: place.phone || null,
          website: place.website || null,
          openingHours: place.openingHours || null,
          photos: place.photos || null,
          priceLevel: place.priceLevel || null,
          estimatedDuration: place.duration || 60,
          estimatedCost: place.cost || 0,
          source: place.source || null,
          coordinates: place.latitude && place.longitude ? {
            lat: place.latitude,
            lng: place.longitude,
          } : null,
        })),
        route: {
          totalDistance: Math.round(day.totalDistance * 10) / 10,
          optimizationAlgorithm: day.algorithm || null,
        },
      };
    });

    // Generate tips
    const tips = this.generateTips(destination, travelStyle, days);

    // Generate packing list
    const packingList = this.generatePackingList(destination, numDays, travelStyle);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithm: 'atrips-v3-tsp-only',
        version: '3.0.0',
      },
      trip: {
        destination,
        startDate,
        endDate,
        duration: `${numDays} days ${numDays - 1} nights`,
        travelers,
        travelStyle,
      },
      budget: {
        total: budget || dailyBudget * numDays,
        perDay: dailyBudget,
        currency: 'VND',
        breakdown: {
          accommodation: Math.round(dailyBudget * 0.35 * numDays),
          food: Math.round(dailyBudget * 0.25 * numDays),
          activities: Math.round(dailyBudget * 0.25 * numDays),
          transport: Math.round(dailyBudget * 0.10 * numDays),
          miscellaneous: Math.round(dailyBudget * 0.05 * numDays),
        },
      },
      summary: {
        totalPlaces,
        totalDistance: Math.round(totalDistance * 10) / 10,
        avgPlacesPerDay: Math.round(totalPlaces / numDays * 10) / 10,
      },
      days: itineraryDays,
      tips,
      packingList,
    };
  }

  /**
   * Detect theme for a day based on activities
   */
  detectDayTheme(activities) {
    if (!activities || activities.length === 0) return 'Exploration';

    const types = activities.map(a => a.type).filter(Boolean);

    if (types.includes('BEACH') || types.some(t => t.includes('beach'))) {
      return 'Beach day';
    }
    if (types.filter(t => t === 'RESTAURANT' || t === 'CAFE').length >= 2) {
      return 'Food exploration';
    }
    if (types.filter(t => t === 'ATTRACTION' || t === 'MUSEUM').length >= 2) {
      return 'Sightseeing & discovery';
    }
    if (types.includes('ACTIVITY')) {
      return 'Activity day';
    }
    if (types.includes('SHOPPING')) {
      return 'Shopping & entertainment';
    }

    return 'Exploring ' + (activities[0]?.city || 'the area');
  }

  /**
   * Generate travel tips
   */
  generateTips(destination, travelStyle, days) {
    const tips = [
      `Carry cash as some places in ${destination} may not accept cards`,
      'Book tickets for popular attractions in advance to avoid queues',
      'Download offline maps in case you lose connectivity',
    ];

    if (travelStyle === 'budget') {
      tips.push('Eat at local restaurants to save money and enjoy authentic cuisine');
    }

    if (days.length > 3) {
      tips.push('Long trip — get enough rest to stay energized for exploring');
    }

    return tips;
  }

  /**
   * Generate packing list
   */
  generatePackingList(destination, numDays, travelStyle) {
    const essentials = [
      'ID / passport',
      'Phone and portable charger',
      'Cash and bank cards',
      'Personal medication',
    ];

    const clothing = [
      `${Math.min(numDays + 1, 7)} sets of clothes`,
      'Light jacket',
      'Comfortable walking shoes',
    ];

    const accessories = [
      'Sunscreen',
      'Hat / cap',
      'Sunglasses',
    ];

    const optional = [];

    if (travelStyle === 'adventure') {
      optional.push('Trekking shoes', 'Water bottle', 'Small backpack');
    }

    if (destination.toLowerCase().includes('biển') ||
        destination.toLowerCase().includes('phú quốc') ||
        destination.toLowerCase().includes('nha trang') ||
        destination.toLowerCase().includes('beach')) {
      optional.push('Swimwear', 'Beach towel', 'Flip-flops');
    }

    if (destination.toLowerCase().includes('đà lạt') ||
        destination.toLowerCase().includes('sapa') ||
        destination.toLowerCase().includes('dalat')) {
      optional.push('Warm jacket', 'Scarf');
    }

    return {
      essentials,
      clothing,
      accessories,
      optional,
    };
  }
}

/**
 * Quick itinerary generation function
 */
export async function generateQuickItinerary(params, places) {
  const planner = new TripPlanner();
  return planner.generateItinerary(params, places);
}

export default TripPlanner;
