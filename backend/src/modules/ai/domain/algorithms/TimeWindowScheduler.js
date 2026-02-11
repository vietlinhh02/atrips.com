/**
 * Time Window Scheduler
 * Schedules activities respecting opening hours, visit duration, and travel time
 */

import { haversineDistance } from './TSPSolver.js';

/**
 * Default activity durations in minutes by type
 */
export const DEFAULT_DURATIONS = {
  ATTRACTION: 90,
  RESTAURANT: 60,
  HOTEL: 30, // Check-in time
  CAFE: 45,
  SHOPPING: 60,
  ACTIVITY: 120,
  OTHER: 60,
};

/**
 * Default opening hours by type
 */
const DEFAULT_HOURS = {
  ATTRACTION: { open: '08:00', close: '17:00' },
  RESTAURANT: { open: '10:00', close: '22:00' },
  HOTEL: { open: '00:00', close: '23:59' },
  CAFE: { open: '07:00', close: '22:00' },
  SHOPPING: { open: '09:00', close: '21:00' },
  ACTIVITY: { open: '08:00', close: '18:00' },
  OTHER: { open: '08:00', close: '20:00' },
};

/**
 * Meal time windows (recommended)
 */
export const MEAL_WINDOWS = {
  breakfast: { start: '07:00', end: '09:30', duration: 45 },
  lunch: { start: '11:30', end: '13:30', duration: 60 },
  dinner: { start: '18:00', end: '20:30', duration: 75 },
};

/**
 * Parse time string to minutes from midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Minutes from midnight
 */
export function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to time string
 * @param {number} minutes - Minutes from midnight
 * @returns {string} Time string in HH:MM format
 */
export function formatTime(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Estimate travel time between two points
 * @param {Object} from - {lat, lng}
 * @param {Object} to - {lat, lng}
 * @param {string} mode - 'driving', 'walking', 'transit'
 * @returns {number} Estimated travel time in minutes
 */
export function estimateTravelTime(from, to, mode = 'driving') {
  const distance = haversineDistance(from, to);

  // Average speeds in km/h
  const speeds = {
    driving: 30, // City driving with traffic
    walking: 5,
    transit: 20,
    bicycling: 15,
  };

  const speed = speeds[mode] || speeds.driving;
  const timeHours = distance / speed;
  const timeMinutes = Math.ceil(timeHours * 60);

  // Add buffer for parking, walking to entrance, etc.
  const buffer = mode === 'driving' ? 10 : 5;

  return timeMinutes + buffer;
}

/**
 * Get opening hours for a place
 * @param {Object} place - Place object
 * @returns {Object} {open: number, close: number} in minutes
 */
export function getOpeningHours(place) {
  // Try to parse from place data
  if (place.openingHours) {
    if (typeof place.openingHours === 'string') {
      // Try to parse simple format "08:00-17:00"
      const match = place.openingHours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (match) {
        return {
          open: parseTime(match[1]),
          close: parseTime(match[2]),
        };
      }
    } else if (place.openingHours.open && place.openingHours.close) {
      return {
        open: parseTime(place.openingHours.open),
        close: parseTime(place.openingHours.close),
      };
    }
  }

  // Use default based on type
  const type = place.type || 'OTHER';
  const defaults = DEFAULT_HOURS[type] || DEFAULT_HOURS.OTHER;

  return {
    open: parseTime(defaults.open),
    close: parseTime(defaults.close),
  };
}

/**
 * Get visit duration for a place
 * @param {Object} place - Place object
 * @returns {number} Duration in minutes
 */
export function getVisitDuration(place) {
  if (place.duration) return place.duration;
  if (place.estimatedDuration) return place.estimatedDuration;

  const type = place.type || 'OTHER';
  return DEFAULT_DURATIONS[type] || DEFAULT_DURATIONS.OTHER;
}

/**
 * Check if a time slot is within opening hours
 * @param {number} startTime - Start time in minutes
 * @param {number} duration - Duration in minutes
 * @param {Object} hours - {open, close} in minutes
 * @returns {boolean}
 */
export function isWithinHours(startTime, duration, hours) {
  const endTime = startTime + duration;
  return startTime >= hours.open && endTime <= hours.close;
}

/**
 * Find the best time slot for a place
 * @param {Object} place - Place to schedule
 * @param {number} earliestStart - Earliest possible start time
 * @param {number} latestEnd - Latest possible end time
 * @returns {Object|null} {start, end} or null if not possible
 */
export function findTimeSlot(place, earliestStart, latestEnd) {
  const hours = getOpeningHours(place);
  const duration = getVisitDuration(place);

  // Adjust start time to opening hours
  let start = Math.max(earliestStart, hours.open);

  // Check if we can fit the visit
  const end = start + duration;

  if (end <= Math.min(latestEnd, hours.close)) {
    return { start, end, duration };
  }

  return null;
}

/**
 * Schedule activities for a single day
 * @param {Array} places - Array of places to visit (already optimized by TSP)
 * @param {Object} options - Scheduling options
 * @returns {Object} Scheduled day plan
 */
export function scheduleDayActivities(places, options = {}) {
  const {
    dayStart = '08:00',
    dayEnd = '21:00',
    includeBreakfast = true,
    includeLunch = true,
    includeDinner = true,
    travelMode = 'driving',
    startLocation = null, // Hotel or starting point
  } = options;

  const dayStartMinutes = parseTime(dayStart);
  const dayEndMinutes = parseTime(dayEnd);

  const schedule = [];
  let currentTime = dayStartMinutes;
  let currentLocation = startLocation;

  // Add breakfast if requested
  if (includeBreakfast && currentTime < parseTime(MEAL_WINDOWS.breakfast.end)) {
    const breakfastStart = Math.max(currentTime, parseTime(MEAL_WINDOWS.breakfast.start));
    schedule.push({
      type: 'meal',
      mealType: 'breakfast',
      startTime: formatTime(breakfastStart),
      endTime: formatTime(breakfastStart + MEAL_WINDOWS.breakfast.duration),
      duration: MEAL_WINDOWS.breakfast.duration,
      suggestion: 'Breakfast at hotel or nearby',
    });
    currentTime = breakfastStart + MEAL_WINDOWS.breakfast.duration;
  }

  // Schedule each place
  for (let i = 0; i < places.length; i++) {
    const place = places[i];

    // Calculate travel time from current location
    let travelTime = 0;
    if (currentLocation && place.latitude && place.longitude) {
      travelTime = estimateTravelTime(
        { lat: currentLocation.latitude, lng: currentLocation.longitude },
        { lat: place.latitude, lng: place.longitude },
        travelMode
      );
    }

    // Add travel time
    if (travelTime > 0) {
      schedule.push({
        type: 'travel',
        from: currentLocation?.name || 'Current location',
        to: place.name,
        startTime: formatTime(currentTime),
        endTime: formatTime(currentTime + travelTime),
        duration: travelTime,
        mode: travelMode,
      });
      currentTime += travelTime;
    }

    // Check if we need lunch break
    if (includeLunch &&
        currentTime >= parseTime(MEAL_WINDOWS.lunch.start) &&
        currentTime < parseTime(MEAL_WINDOWS.lunch.end) &&
        !schedule.some(s => s.mealType === 'lunch')) {

      // Insert lunch before this activity if it's a good time
      const lunchEnd = currentTime + MEAL_WINDOWS.lunch.duration;

      // Check if the current place is a restaurant
      if (place.type === 'RESTAURANT') {
        // Use this restaurant for lunch
        const slot = findTimeSlot(place, currentTime, dayEndMinutes);
        if (slot) {
          schedule.push({
            type: 'activity',
            place: place,
            startTime: formatTime(slot.start),
            endTime: formatTime(slot.end),
            duration: slot.duration,
            mealType: 'lunch',
          });
          currentTime = slot.end;
          currentLocation = place;
          continue;
        }
      } else {
        // Add generic lunch break
        schedule.push({
          type: 'meal',
          mealType: 'lunch',
          startTime: formatTime(currentTime),
          endTime: formatTime(lunchEnd),
          duration: MEAL_WINDOWS.lunch.duration,
          suggestion: 'Lunch at a nearby restaurant',
        });
        currentTime = lunchEnd;
      }
    }

    // Find time slot for the place
    const slot = findTimeSlot(place, currentTime, dayEndMinutes);

    if (slot) {
      schedule.push({
        type: 'activity',
        place: place,
        startTime: formatTime(slot.start),
        endTime: formatTime(slot.end),
        duration: slot.duration,
      });
      currentTime = slot.end;
      currentLocation = place;
    } else {
      // Can't fit this activity, add to skipped list
      schedule.push({
        type: 'skipped',
        place: place,
        reason: 'Not enough time or outside opening hours',
      });
    }
  }

  // Add dinner if requested and time allows
  if (includeDinner && currentTime < parseTime(MEAL_WINDOWS.dinner.end)) {
    const dinnerStart = Math.max(currentTime, parseTime(MEAL_WINDOWS.dinner.start));
    if (dinnerStart + MEAL_WINDOWS.dinner.duration <= dayEndMinutes) {
      schedule.push({
        type: 'meal',
        mealType: 'dinner',
        startTime: formatTime(dinnerStart),
        endTime: formatTime(dinnerStart + MEAL_WINDOWS.dinner.duration),
        duration: MEAL_WINDOWS.dinner.duration,
        suggestion: 'Dinner at a local restaurant',
      });
    }
  }

  // Calculate statistics
  const activities = schedule.filter(s => s.type === 'activity');
  const travels = schedule.filter(s => s.type === 'travel');
  const skipped = schedule.filter(s => s.type === 'skipped');

  return {
    schedule,
    statistics: {
      totalActivities: activities.length,
      totalTravelTime: travels.reduce((sum, t) => sum + t.duration, 0),
      totalActivityTime: activities.reduce((sum, a) => sum + a.duration, 0),
      skippedCount: skipped.length,
      dayUtilization: Math.round(
        ((activities.reduce((sum, a) => sum + a.duration, 0) + travels.reduce((sum, t) => sum + t.duration, 0)) /
          (dayEndMinutes - dayStartMinutes)) * 100
      ),
    },
  };
}

/**
 * Schedule activities for multiple days (VRP-like)
 * @param {Array} places - All places to visit
 * @param {number} numDays - Number of days
 * @param {Object} options - Scheduling options
 * @returns {Array} Array of day schedules
 */
export function scheduleMultipleDays(places, numDays, options = {}) {
  const {
    hotelLocation = null,
    balanceLoad = true, // Try to balance activities across days
    prioritizeNearby = true, // Group nearby places on same day
  } = options;

  // Calculate optimal places per day
  const placesPerDay = Math.ceil(places.length / numDays);

  // Group places by proximity if requested
  let groupedPlaces;
  if (prioritizeNearby && places.every(p => p.latitude && p.longitude)) {
    groupedPlaces = groupPlacesByProximity(places, numDays);
  } else {
    // Simple distribution
    groupedPlaces = [];
    for (let i = 0; i < numDays; i++) {
      const start = i * placesPerDay;
      const end = Math.min(start + placesPerDay, places.length);
      groupedPlaces.push(places.slice(start, end));
    }
  }

  // Balance load across days if requested
  if (balanceLoad && groupedPlaces.length > 1) {
    const totalPlaces = places.length;
    const idealPerDay = totalPlaces / numDays;

    // Redistribute if some days have too many or too few places
    for (let i = 0; i < groupedPlaces.length - 1; i++) {
      while (groupedPlaces[i].length > Math.ceil(idealPerDay) &&
             groupedPlaces[i + 1].length < Math.floor(idealPerDay)) {
        const place = groupedPlaces[i].pop();
        groupedPlaces[i + 1].unshift(place);
      }
    }
  }

  // Schedule each day
  const daySchedules = [];
  for (let day = 0; day < numDays; day++) {
    const dayPlaces = groupedPlaces[day] || [];
    const daySchedule = scheduleDayActivities(dayPlaces, {
      ...options,
      startLocation: hotelLocation,
    });

    daySchedules.push({
      day: day + 1,
      ...daySchedule,
    });
  }

  return daySchedules;
}

/**
 * Group places by proximity using simple clustering
 * @param {Array} places - Places to group
 * @param {number} numGroups - Number of groups (days)
 * @returns {Array<Array>} Grouped places
 */
function groupPlacesByProximity(places, numGroups) {
  if (places.length <= numGroups) {
    return places.map(p => [p]);
  }

  // Simple K-means-like clustering
  const groups = Array(numGroups).fill(null).map(() => []);

  // Initialize centroids with first N places
  const centroids = places.slice(0, numGroups).map(p => ({
    lat: p.latitude,
    lng: p.longitude,
  }));

  // Assign each place to nearest centroid
  for (const place of places) {
    let minDist = Infinity;
    let nearestGroup = 0;

    for (let i = 0; i < numGroups; i++) {
      const dist = haversineDistance(
        { lat: place.latitude, lng: place.longitude },
        centroids[i]
      );
      if (dist < minDist) {
        minDist = dist;
        nearestGroup = i;
      }
    }

    groups[nearestGroup].push(place);
  }

  // Balance groups if some are empty or too full
  const avgSize = Math.ceil(places.length / numGroups);
  for (let i = 0; i < numGroups; i++) {
    while (groups[i].length > avgSize * 1.5) {
      // Move excess to smallest group
      const smallest = groups.reduce((min, g, idx) =>
        g.length < groups[min].length ? idx : min, 0);
      if (smallest !== i && groups[smallest].length < avgSize) {
        groups[smallest].push(groups[i].pop());
      } else {
        break;
      }
    }
  }

  return groups;
}

export default {
  parseTime,
  formatTime,
  estimateTravelTime,
  getOpeningHours,
  getVisitDuration,
  findTimeSlot,
  scheduleDayActivities,
  scheduleMultipleDays,
  MEAL_WINDOWS,
  DEFAULT_DURATIONS,
};
