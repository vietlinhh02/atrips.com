/**
 * Itinerary Verification Service
 * Validates generated itineraries for time feasibility, route
 * efficiency, budget adherence, and opening hours.
 */

import { haversineDistance } from './TSPSolver.js';

const MIN_DAY_HOURS = 8;
const MAX_DAY_HOURS = 14;
const AVG_CITY_SPEED_KMH = 30;
const TRANSIT_BUFFER_MINUTES = 10;
const REORDER_SAVINGS_THRESHOLD = 0.20;

/**
 * Verify a full itinerary and return feasibility results.
 *
 * @param {Object} itinerary - Itinerary with `days` array
 * @param {Object} [options] - Verification options
 * @param {number} [options.budget] - Total trip budget (VND)
 * @param {string} [options.currency] - Currency code
 * @returns {import('./types').VerificationResult}
 */
export function verifyItinerary(itinerary, options = {}) {
  const days = itinerary?.days;
  if (!Array.isArray(days) || days.length === 0) {
    return buildResult(true, 100, [], []);
  }

  const violations = [];
  const suggestions = [];

  for (const day of days) {
    const dayNum = day.dayNumber ?? day.day ?? 0;
    const activities = normalizeActivities(day);

    if (activities.length < 2) continue;

    violations.push(
      ...checkTimeOverlaps(activities, dayNum),
      ...checkTravelFeasibility(activities, dayNum),
      ...checkDayLength(activities, dayNum),
      ...checkOpeningHours(activities, dayNum),
    );

    suggestions.push(
      ...suggestReorder(activities, dayNum),
    );
  }

  const budgetViolations = checkBudget(days, options);
  violations.push(...budgetViolations);

  const score = computeScore(violations);

  return buildResult(
    violations.length === 0,
    score,
    violations,
    suggestions,
  );
}

/**
 * Normalize heterogeneous activity shapes into a uniform format.
 * Handles both synthesizer output (time/duration/estimatedCost) and
 * TripPlanner output (estimatedDuration/coordinates).
 *
 * @param {Object} day - A single day object from the itinerary
 * @returns {Array<Object>} Normalized activity list
 */
function normalizeActivities(day) {
  const raw = day.activities || day.places || [];
  return raw.map((a, idx) => {
    const coords = extractCoordinates(a);
    const startMinutes = parseTimeToMinutes(
      a.time || a.startTime || null
    );
    const duration = a.duration
      || a.estimatedDuration
      || 60;
    const cost = a.estimatedCost ?? a.cost ?? 0;
    const name = a.name || a.title || `Activity ${idx + 1}`;

    return {
      index: idx,
      name,
      type: (a.type || 'OTHER').toUpperCase(),
      startMinutes,
      duration,
      endMinutes: startMinutes != null
        ? startMinutes + duration
        : null,
      cost,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      openingHours: a.openingHours || null,
    };
  });
}

/**
 * Extract lat/lng from various coordinate formats.
 *
 * @param {Object} activity
 * @returns {{ lat: number, lng: number } | null}
 */
function extractCoordinates(activity) {
  if (activity.latitude != null && activity.longitude != null) {
    return { lat: activity.latitude, lng: activity.longitude };
  }
  const c = activity.coordinates;
  if (c && c.lat != null && c.lng != null) {
    return { lat: c.lat, lng: c.lng };
  }
  return null;
}

/**
 * Parse "HH:MM" or minutes-from-midnight into minutes.
 *
 * @param {string|number|null} time
 * @returns {number|null}
 */
function parseTimeToMinutes(time) {
  if (time == null) return null;
  if (typeof time === 'number') return time;
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Format minutes from midnight to "HH:MM".
 *
 * @param {number} mins
 * @returns {string}
 */
function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Time Overlap Check ──────────────────────────────────

/**
 * Detect activities whose time windows overlap within a day.
 *
 * @param {Array} activities - Normalized activities
 * @param {number} dayNum
 * @returns {Array} Violations
 */
function checkTimeOverlaps(activities, dayNum) {
  const timed = activities.filter(a => a.startMinutes != null);
  if (timed.length < 2) return [];

  const sorted = [...timed].sort(
    (a, b) => a.startMinutes - b.startMinutes
  );
  const violations = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr.endMinutes > next.startMinutes) {
      violations.push({
        type: 'time_overlap',
        day: dayNum,
        activities: [curr.name, next.name],
        message:
          `"${curr.name}" ends at ${fmtTime(curr.endMinutes)} ` +
          `but "${next.name}" starts at ` +
          `${fmtTime(next.startMinutes)} (overlap: ` +
          `${curr.endMinutes - next.startMinutes} min)`,
      });
    }
  }

  return violations;
}

// ── Travel Feasibility Check ────────────────────────────

/**
 * Verify consecutive activities have enough travel time between
 * them based on Haversine distance and city driving speed.
 *
 * @param {Array} activities - Normalized activities
 * @param {number} dayNum
 * @returns {Array} Violations
 */
function checkTravelFeasibility(activities, dayNum) {
  const violations = [];
  const withCoords = activities.filter(
    a => a.lat != null && a.lng != null
  );
  if (withCoords.length < 2) return violations;

  let totalKm = 0;

  for (let i = 0; i < withCoords.length - 1; i++) {
    const from = withCoords[i];
    const to = withCoords[i + 1];
    const dist = haversineDistance(
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
    );
    totalKm += dist;

    if (from.endMinutes == null || to.startMinutes == null) continue;

    const gap = to.startMinutes - from.endMinutes;
    const travelMinutes =
      (dist / AVG_CITY_SPEED_KMH) * 60 + TRANSIT_BUFFER_MINUTES;

    if (gap < travelMinutes) {
      violations.push({
        type: 'insufficient_travel_time',
        day: dayNum,
        activities: [from.name, to.name],
        distanceKm: round1(dist),
        availableMinutes: gap,
        requiredMinutes: Math.ceil(travelMinutes),
        message:
          `${Math.ceil(travelMinutes)} min needed to travel ` +
          `${round1(dist)} km from "${from.name}" to ` +
          `"${to.name}", but only ${gap} min available`,
      });
    }
  }

  if (totalKm > 40) {
    violations.push({
      type: 'excessive_travel',
      day: dayNum,
      totalKm: round1(totalKm),
      message:
        `Day ${dayNum} requires ${round1(totalKm)} km of total ` +
        `travel, which may be tiring`,
    });
  }

  return violations;
}

// ── Day Length Check ────────────────────────────────────

/**
 * Check if total activity + travel time exceeds a reasonable
 * day length (8-14 hours).
 *
 * @param {Array} activities - Normalized activities
 * @param {number} dayNum
 * @returns {Array} Violations
 */
function checkDayLength(activities, dayNum) {
  const timed = activities.filter(a => a.startMinutes != null);
  if (timed.length === 0) return [];

  const earliest = Math.min(...timed.map(a => a.startMinutes));
  const latest = Math.max(
    ...timed.map(a => a.endMinutes ?? a.startMinutes)
  );
  const spanHours = (latest - earliest) / 60;

  if (spanHours > MAX_DAY_HOURS) {
    return [{
      type: 'day_too_long',
      day: dayNum,
      hours: round1(spanHours),
      message:
        `Day ${dayNum} spans ${round1(spanHours)} hours ` +
        `(${fmtTime(earliest)}-${fmtTime(latest)}), ` +
        `exceeding the ${MAX_DAY_HOURS}-hour recommended maximum`,
    }];
  }

  if (spanHours < MIN_DAY_HOURS && timed.length >= 3) {
    return [{
      type: 'day_too_short',
      day: dayNum,
      hours: round1(spanHours),
      message:
        `Day ${dayNum} only spans ${round1(spanHours)} hours ` +
        `with ${timed.length} activities. Consider adding more ` +
        `time between activities or additional stops.`,
    }];
  }

  return [];
}

// ── Opening Hours Check ─────────────────────────────────

/**
 * Verify scheduled times fall within known opening hours.
 * This is a soft check -- missing data is not a violation.
 *
 * @param {Array} activities - Normalized activities
 * @param {number} dayNum
 * @returns {Array} Violations
 */
function checkOpeningHours(activities, dayNum) {
  const violations = [];

  for (const act of activities) {
    if (act.startMinutes == null || !act.openingHours) continue;

    const hours = parseOpeningHoursRange(act.openingHours);
    if (!hours) continue;

    const endMin = act.endMinutes ?? act.startMinutes + act.duration;

    if (act.startMinutes < hours.open) {
      violations.push({
        type: 'before_opening',
        day: dayNum,
        activity: act.name,
        scheduled: fmtTime(act.startMinutes),
        opens: fmtTime(hours.open),
        message:
          `"${act.name}" is scheduled at ` +
          `${fmtTime(act.startMinutes)} but opens at ` +
          `${fmtTime(hours.open)}`,
      });
    }

    if (endMin > hours.close) {
      violations.push({
        type: 'after_closing',
        day: dayNum,
        activity: act.name,
        scheduledEnd: fmtTime(endMin),
        closes: fmtTime(hours.close),
        message:
          `"${act.name}" ends at ${fmtTime(endMin)} but ` +
          `closes at ${fmtTime(hours.close)}`,
      });
    }
  }

  return violations;
}

/**
 * Parse opening hours from string or object into
 * { open, close } in minutes from midnight.
 *
 * @param {string|Object} raw
 * @returns {{ open: number, close: number } | null}
 */
function parseOpeningHoursRange(raw) {
  if (!raw) return null;

  if (typeof raw === 'object' && raw.open && raw.close) {
    const open = parseTimeToMinutes(raw.open);
    const close = parseTimeToMinutes(raw.close);
    if (open != null && close != null) return { open, close };
  }

  if (typeof raw === 'string') {
    const match = raw.match(/(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})/);
    if (match) {
      const open = parseTimeToMinutes(match[1]);
      const close = parseTimeToMinutes(match[2]);
      if (open != null && close != null) return { open, close };
    }
  }

  return null;
}

// ── Budget Check ────────────────────────────────────────

/**
 * Sum activity costs across all days and compare against
 * the trip budget.
 *
 * @param {Array} days - Itinerary days
 * @param {Object} options
 * @returns {Array} Violations
 */
function checkBudget(days, options) {
  const budget = options.budget;
  if (!budget || budget <= 0) return [];

  const breakdown = {};
  let totalCost = 0;

  for (const day of days) {
    const activities = day.activities || day.places || [];
    for (const act of activities) {
      const cost = act.estimatedCost ?? act.cost ?? 0;
      totalCost += cost;
      const category = (act.type || 'OTHER').toUpperCase();
      breakdown[category] = (breakdown[category] || 0) + cost;
    }
  }

  if (totalCost > budget) {
    const currency = options.currency || 'VND';
    return [{
      type: 'over_budget',
      totalCost,
      budget,
      excess: totalCost - budget,
      currency,
      breakdown,
      message:
        `Total activity cost (${fmt(totalCost)} ${currency}) ` +
        `exceeds budget (${fmt(budget)} ${currency}) by ` +
        `${fmt(totalCost - budget)} ${currency}`,
    }];
  }

  return [];
}

// ── Reorder Suggestion ──────────────────────────────────

/**
 * Check if swapping two consecutive activities reduces total
 * travel distance by more than the threshold.
 * Uses a greedy pairwise approach (not full TSP) to stay fast.
 *
 * @param {Array} activities - Normalized activities
 * @param {number} dayNum
 * @returns {Array} Suggestions
 */
function suggestReorder(activities, dayNum) {
  const withCoords = activities.filter(
    a => a.lat != null && a.lng != null
  );
  if (withCoords.length < 3) return [];

  const originalDist = totalRouteDistance(withCoords);
  if (originalDist === 0) return [];

  let bestOrder = null;
  let bestDist = originalDist;

  for (let i = 0; i < withCoords.length - 1; i++) {
    const swapped = [...withCoords];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    const dist = totalRouteDistance(swapped);
    if (dist < bestDist) {
      bestDist = dist;
      bestOrder = swapped.map(a => a.index);
    }
  }

  if (!bestOrder) return [];

  const savings = originalDist - bestDist;
  const savingsRatio = savings / originalDist;

  if (savingsRatio < REORDER_SAVINGS_THRESHOLD) return [];

  return [{
    type: 'reorder',
    day: dayNum,
    from: withCoords.map(a => a.index),
    to: bestOrder,
    savesKm: round1(savings),
    savingsPercent: Math.round(savingsRatio * 100),
    message:
      `Reordering activities on day ${dayNum} saves ` +
      `${round1(savings)} km (${Math.round(savingsRatio * 100)}% ` +
      `reduction)`,
  }];
}

/**
 * Sum Haversine distances along a sequential route.
 *
 * @param {Array} points - Objects with lat/lng
 * @returns {number} Total distance in km
 */
function totalRouteDistance(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineDistance(
      { lat: points[i].lat, lng: points[i].lng },
      { lat: points[i + 1].lat, lng: points[i + 1].lng },
    );
  }
  return total;
}

// ── Scoring ─────────────────────────────────────────────

const VIOLATION_WEIGHTS = {
  time_overlap: 15,
  insufficient_travel_time: 10,
  excessive_travel: 5,
  day_too_long: 8,
  day_too_short: 3,
  before_opening: 7,
  after_closing: 7,
  over_budget: 12,
};

/**
 * Compute a 0-100 feasibility score based on violation count
 * and severity weights.
 *
 * @param {Array} violations
 * @returns {number}
 */
function computeScore(violations) {
  if (violations.length === 0) return 100;

  let penalty = 0;
  for (const v of violations) {
    penalty += VIOLATION_WEIGHTS[v.type] || 5;
  }

  return Math.max(0, 100 - penalty);
}

// ── Helpers ─────────────────────────────────────────────

function buildResult(isValid, score, violations, suggestions) {
  return { isValid, score, violations, suggestions };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function fmt(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export default { verifyItinerary };
