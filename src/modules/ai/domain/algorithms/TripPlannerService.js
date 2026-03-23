import { solveTSP, haversineDistance } from './TSPSolver.js';
import { logger } from '../../../../shared/services/LoggerService.js';

function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function estimateDailyBudget(travelStyle, destination) {
  const baseBudgets = {
    budget: 500000,
    comfort: 1500000,
    luxury: 5000000,
    adventure: 1000000,
    cultural: 800000,
  };

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

export class TripPlanner {
  constructor(options = {}) {
    this.options = {
      enableCaching: true,
      useAIEnhancement: false,
      ...options,
    };
  }

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
      dailyRhythm = null,
      dietaryRestrictions = [],
      accessibilityNeeds = [],
    } = params;

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │           TRIP PLANNER PIPELINE STARTED                 │');
    logger.info('  └─────────────────────────────────────────────────────────┘');

    const numDays = calculateDays(startDate, endDate);
    const dailyMoneyBudget = budget
      ? Math.round(budget / numDays)
      : estimateDailyBudget(travelStyle, destination);

    logger.info(`     Destination: ${destination}, Duration: ${numDays} days, Style: ${travelStyle}`);

    logger.info(`  [Step 1/3] Filtering places for destination...`);
    let destinationPlaces = this.filterByDestination(availablePlaces, destination);
    logger.info(`     - Found ${destinationPlaces.length} places in ${destination}`);

    // Soft fallback: use all radius-filtered places if destination filter is too strict
    if (destinationPlaces.length < 5 && availablePlaces.length > destinationPlaces.length) {
      logger.info(`     - Destination filter too strict, using all ${availablePlaces.length} radius-filtered places`);
      destinationPlaces = availablePlaces;
    }

    let filteredPlaces = destinationPlaces;
    if (avoidTypes.length > 0) {
      filteredPlaces = destinationPlaces.filter(p => !avoidTypes.includes(p.type));
      logger.info(`     - After excluding ${avoidTypes.join(', ')}: ${filteredPlaces.length} places`);
    }

    const allPlaces = this.addMustSeeAttractions(filteredPlaces, mustSeeAttractions, destinationPlaces);
    if (mustSeeAttractions.length > 0) {
      logger.info(`     - Added ${mustSeeAttractions.length} must-see attractions`);
    }
    logger.info(`     - Total places for planning: ${allPlaces.length}`);

    logger.info(`  [Step 2/3] Clustering places into ${numDays} days by proximity...`);
    const dayPlans = await this.organizeDays(allPlaces, numDays, { hotelLocation, travelStyle });
    logger.info(`     - Clustered ${allPlaces.length} places across ${dayPlans.length} days`);

    logger.info(`  [Step 3/3] TSP Route Optimization...`);
    for (const day of dayPlans) {
      logger.info(`     - Day ${day.day}: ${day.route.length} places, ${Math.round(day.totalDistance * 10) / 10} km`);
    }

    const itinerary = this.formatItinerary({
      destination, startDate, endDate, numDays, travelStyle, travelers,
      budget, dailyBudget: dailyMoneyBudget, days: dayPlans,
      dailyRhythm, dietaryRestrictions, accessibilityNeeds,
    });

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │           TRIP PLANNER PIPELINE COMPLETE                │');
    logger.info('  └─────────────────────────────────────────────────────────┘');

    return itinerary;
  }

  filterByDestination(places, destination) {
    const destLower = (destination || '').toLowerCase();
    return places.filter(place => {
      const placeLocation = [place.city, place.address, place.region]
        .filter(Boolean).join(' ').toLowerCase();
      return placeLocation.includes(destLower);
    });
  }

  addMustSeeAttractions(places, mustSeeNames, allPlaces) {
    const result = [...places];
    const existingNames = new Set(places.map(p => (p.name || '').toLowerCase()));

    for (const name of mustSeeNames) {
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) continue;
      const found = allPlaces.find(p => (p.name || '').toLowerCase().includes(name.toLowerCase()));
      if (found) result.unshift({ ...found, mustSee: true });
    }

    return result;
  }

  async organizeDays(places, numDays, options) {
    const { hotelLocation, travelStyle } = options;

    if (places.length === 0) {
      return Array(numDays).fill(null).map((_, i) => ({
        day: i + 1, places: [], route: [], totalDistance: 0,
      }));
    }

    const dayGroups = this.clusterPlacesByDay(places, numDays, hotelLocation);
    const optimizedDays = [];

    for (let i = 0; i < numDays; i++) {
      const dayPlaces = dayGroups[i] || [];

      if (dayPlaces.length < 2) {
        optimizedDays.push({ day: i + 1, places: dayPlaces, route: dayPlaces, totalDistance: 0 });
        continue;
      }

      let placesWithStart = dayPlaces;
      if (hotelLocation?.latitude && hotelLocation?.longitude) {
        placesWithStart = [{ ...hotelLocation, name: 'Hotel', type: 'START' }, ...dayPlaces];
      }

      const tspAlgorithm = travelStyle === 'luxury' ? 'nearest_neighbor' : 'two_opt';
      const tspResult = solveTSP(placesWithStart, { algorithm: tspAlgorithm });
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
   * Distribute places evenly across all days using stride-based indexing.
   * Avoids the front-loading problem of sequential fill (floor(i/avgPerDay))
   * which left later days empty for long trips.
   * Caps at MAX_PLACES_PER_DAY to keep itineraries realistic and token-efficient.
   */
  clusterPlacesByDay(places, numDays, hotelLocation) {
    const MAX_PLACES_PER_DAY = 8;
    const groups = Array(numDays).fill(null).map(() => []);
    if (places.length === 0) return groups;

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

    // Limit total places distributed to avoid bloated itineraries
    const maxTotal = MAX_PLACES_PER_DAY * numDays;
    const placesToDistribute = sortedPlaces.slice(0, maxTotal);

    for (let i = 0; i < placesToDistribute.length; i++) {
      const dayIndex = Math.min(Math.floor(i * numDays / placesToDistribute.length), numDays - 1);
      if (groups[dayIndex].length < MAX_PLACES_PER_DAY) {
        groups[dayIndex].push(placesToDistribute[i]);
      }
    }

    return groups;
  }

  formatItinerary(data) {
    const {
      destination, startDate, endDate, numDays, travelStyle, travelers,
      budget, dailyBudget, days, dailyRhythm, dietaryRestrictions, accessibilityNeeds,
    } = data;

    const totalDistance = days.reduce((sum, d) => sum + (d.totalDistance || 0), 0);
    const totalPlaces = days.reduce((sum, d) => sum + d.route.length, 0);

    const itineraryDays = days.map((day, index) => {
      const date = startDate
        ? new Date(new Date(startDate).getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      return {
        dayNumber: index + 1,
        date,
        theme: this.detectDayTheme(day.route),
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
          coordinates: place.latitude && place.longitude
            ? { lat: place.latitude, lng: place.longitude }
            : null,
        })),
        route: {
          totalDistance: Math.round(day.totalDistance * 10) / 10,
          optimizationAlgorithm: day.algorithm || null,
        },
      };
    });

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithm: 'atrips-v3-tsp-only',
        version: '3.0.0',
      },
      trip: { destination, startDate, endDate, duration: `${numDays} days ${numDays - 1} nights`, travelers, travelStyle },
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
      tips: this.generateTips(destination, travelStyle, days),
      packingList: this.generatePackingList(destination, numDays, travelStyle),
      userPreferences: {
        dailyRhythm: dailyRhythm || null,
        dietaryRestrictions: dietaryRestrictions?.length > 0 ? dietaryRestrictions : null,
        accessibilityNeeds: accessibilityNeeds?.length > 0 ? accessibilityNeeds : null,
      },
    };
  }

  detectDayTheme(activities) {
    if (!activities || activities.length === 0) return 'Exploration';
    const types = activities.map(a => a.type).filter(Boolean);
    if (types.includes('BEACH') || types.some(t => t.includes('beach'))) return 'Beach day';
    if (types.filter(t => t === 'RESTAURANT' || t === 'CAFE').length >= 2) return 'Food exploration';
    if (types.filter(t => t === 'ATTRACTION' || t === 'MUSEUM').length >= 2) return 'Sightseeing & discovery';
    if (types.includes('ACTIVITY')) return 'Activity day';
    if (types.includes('SHOPPING')) return 'Shopping & entertainment';
    return 'Exploring ' + (activities[0]?.city || 'the area');
  }

  generateTips(destination, travelStyle, days) {
    const tips = [
      `Carry cash as some places in ${destination} may not accept cards`,
      'Book tickets for popular attractions in advance to avoid queues',
      'Download offline maps in case you lose connectivity',
    ];
    if (travelStyle === 'budget') tips.push('Eat at local restaurants to save money and enjoy authentic cuisine');
    if (days.length > 3) tips.push('Long trip — get enough rest to stay energized for exploring');
    return tips;
  }

  generatePackingList(destination, numDays, travelStyle) {
    const essentials = ['ID / passport', 'Phone and portable charger', 'Cash and bank cards', 'Personal medication'];
    const clothing = [`${Math.min(numDays + 1, 7)} sets of clothes`, 'Light jacket', 'Comfortable walking shoes'];
    const accessories = ['Sunscreen', 'Hat / cap', 'Sunglasses'];
    const optional = [];

    if (travelStyle === 'adventure') optional.push('Trekking shoes', 'Water bottle', 'Small backpack');

    const dest = (destination || '').toLowerCase();
    if (dest.includes('biển') || dest.includes('phú quốc') || dest.includes('nha trang') || dest.includes('beach')) {
      optional.push('Swimwear', 'Beach towel', 'Flip-flops');
    }
    if (dest.includes('đà lạt') || dest.includes('sapa') || dest.includes('dalat')) {
      optional.push('Warm jacket', 'Scarf');
    }

    return { essentials, clothing, accessories, optional };
  }
}

export async function generateQuickItinerary(params, places) {
  const planner = new TripPlanner();
  return planner.generateItinerary(params, places);
}

export default TripPlanner;
