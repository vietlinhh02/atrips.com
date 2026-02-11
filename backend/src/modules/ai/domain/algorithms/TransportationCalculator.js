/**
 * Transportation Calculator
 * Calculate transportation details between activities
 */

import { haversineDistance } from './TSPSolver.js';

/**
 * Transport modes with average speeds and costs
 */
const TRANSPORT_MODES = {
  WALK: { speedKmh: 5, baseCostPerKm: 0, name: 'Đi bộ' },
  BIKE: { speedKmh: 15, baseCostPerKm: 0, name: 'Đi xe đạp' },
  TAXI: { speedKmh: 30, baseCostPerKm: 15000, name: 'Taxi' },
  BUS: { speedKmh: 25, baseCostPerKm: 3000, name: 'Xe buýt' },
  SUBWAY: { speedKmh: 40, baseCostPerKm: 5000, name: 'Tàu điện ngầm' },
  TRAIN: { speedKmh: 60, baseCostPerKm: 8000, name: 'Tàu hỏa' },
  CAR: { speedKmh: 40, baseCostPerKm: 10000, name: 'Xe hơi' },
  BOAT: { speedKmh: 20, baseCostPerKm: 20000, name: 'Thuyền' },
  FLIGHT: { speedKmh: 600, baseCostPerKm: 100000, name: 'Máy bay' },
  OTHER: { speedKmh: 30, baseCostPerKm: 10000, name: 'Khác' },
};

/**
 * Determine best transport mode based on distance
 */
export function suggestTransportMode(distanceKm) {
  if (distanceKm <= 1) return 'WALK';
  if (distanceKm <= 5) return 'BIKE';
  if (distanceKm <= 10) return 'TAXI';
  if (distanceKm <= 30) return 'BUS';
  if (distanceKm <= 100) return 'CAR';
  if (distanceKm <= 500) return 'TRAIN';
  return 'FLIGHT';
}

/**
 * Calculate transport details between two points
 */
export function calculateTransport(from, to, preferredMode = null) {
  if (!from || !to || !from.latitude || !from.longitude || !to.latitude || !to.longitude) {
    return null;
  }

  // Calculate straight-line distance
  const distanceKm = haversineDistance(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );

  // Apply road factor (real distance is ~1.3x straight-line)
  const roadFactor = 1.3;
  const realDistanceKm = Math.round(distanceKm * roadFactor * 10) / 10;

  // Suggest transport mode if not specified
  const mode = preferredMode || suggestTransportMode(realDistanceKm);
  const modeInfo = TRANSPORT_MODES[mode] || TRANSPORT_MODES.OTHER;

  // Calculate duration (in minutes)
  const durationMinutes = Math.ceil((realDistanceKm / modeInfo.speedKmh) * 60);

  // Calculate cost
  const baseCost = Math.round(realDistanceKm * modeInfo.baseCostPerKm);
  // Add fixed start cost for taxis
  const cost = mode === 'TAXI' ? baseCost + 10000 : baseCost;

  // Generate basic instructions
  const instructions = generateInstructions(from, to, mode, realDistanceKm);

  return {
    distance: realDistanceKm,
    distanceUnit: 'km',
    duration: durationMinutes,
    durationUnit: 'minutes',
    mode,
    modeName: modeInfo.name,
    cost,
    currency: 'VND',
    instructions,
  };
}

/**
 * Generate simple routing instructions
 */
function generateInstructions(from, to, mode, distanceKm) {
  const modeInfo = TRANSPORT_MODES[mode] || TRANSPORT_MODES.OTHER;
  const fromName = from.name || 'điểm xuất phát';
  const toName = to.name || 'điểm đến';

  if (mode === 'WALK' && distanceKm <= 1) {
    return `Đi bộ từ ${fromName} đến ${toName} (khoảng ${Math.ceil(distanceKm * 1000)} mét)`;
  }

  if (mode === 'TAXI' || mode === 'CAR') {
    return `Di chuyển bằng ${modeInfo.name.toLowerCase()} từ ${fromName} đến ${toName}`;
  }

  if (mode === 'BUS' || mode === 'SUBWAY' || mode === 'TRAIN') {
    return `Sử dụng ${modeInfo.name.toLowerCase()} từ ${fromName} đến ${toName}`;
  }

  return `Di chuyển từ ${fromName} đến ${toName} (${distanceKm} km)`;
}

/**
 * Calculate total transportation for a day
 */
export function calculateDayTransportation(activities, preferredModes = {}) {
  if (!activities || activities.length < 2) {
    return {
      totalDistance: 0,
      totalDuration: 0,
      totalCost: 0,
      segments: [],
    };
  }

  const segments = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;

  for (let i = 1; i < activities.length; i++) {
    const from = activities[i - 1];
    const to = activities[i];

    const transport = calculateTransport(from, to, preferredModes[i]);

    if (transport) {
      segments.push({
        from: from.name,
        to: to.name,
        ...transport,
      });

      totalDistance += transport.distance;
      totalDuration += transport.duration;
      totalCost += transport.cost;
    }
  }

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.ceil(totalDuration),
    totalCost: Math.round(totalCost),
    currency: 'VND',
    segments,
  };
}

/**
 * Add transportation info to activities array
 */
export function enrichActivitiesWithTransport(activities, preferredModes = {}) {
  if (!activities || activities.length < 2) {
    return activities;
  }

  const enriched = [...activities];

  for (let i = 1; i < enriched.length; i++) {
    const from = enriched[i - 1];
    const to = enriched[i];

    const transport = calculateTransport(from, to, preferredModes[i]);

    if (transport) {
      enriched[i].transportFromPrevious = transport;
    }
  }

  return enriched;
}

/**
 * Export for use in other modules
 */
export default {
  suggestTransportMode,
  calculateTransport,
  calculateDayTransportation,
  enrichActivitiesWithTransport,
  TRANSPORT_MODES,
};
