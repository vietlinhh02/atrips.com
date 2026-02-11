/**
 * Trip Phase 1 Controller
 * Handles Phase 1 features: Overview, Transportation, Budget, etc.
 */

import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { sendSuccess } from '../../../../shared/utils/response.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import activityRepository from '../../infrastructure/repositories/ActivityRepository.js';
import itineraryDayRepository from '../../infrastructure/repositories/ItineraryDayRepository.js';
import TransportationCalculator from '../../../ai/domain/algorithms/TransportationCalculator.js';
import prisma from '../../../../config/database.js';

/**
 * GET /api/trips/:tripId/overview
 * Get trip overview (summary, highlights, weather, cultural notes)
 */
export const getTripOverview = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await tripRepository.getTripById(tripId, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  const overview = trip.overview || {
    summary: trip.description || null,
    highlights: [],
    weather: null,
    culturalNotes: null,
    bestTimeToVisit: null,
  };

  return sendSuccess(res, { overview });
});

/**
 * PUT /api/trips/:tripId/overview
 * Update trip overview
 */
export const updateTripOverview = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { summary, highlights, weather, culturalNotes, bestTimeToVisit } = req.body;

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  const trip = await tripRepository.getTripById(tripId, req.user.id);
  const currentOverview = trip.overview || {};

  const updatedOverview = {
    summary: summary !== undefined ? summary : currentOverview.summary,
    highlights: highlights !== undefined ? highlights : currentOverview.highlights,
    weather: weather !== undefined ? weather : currentOverview.weather,
    culturalNotes: culturalNotes !== undefined ? culturalNotes : currentOverview.culturalNotes,
    bestTimeToVisit: bestTimeToVisit !== undefined ? bestTimeToVisit : currentOverview.bestTimeToVisit,
  };

  await tripRepository.updateTrip(tripId, { overview: updatedOverview }, req.user.id);

  return sendSuccess(res, { overview: updatedOverview }, 'Trip overview updated successfully');
});

/**
 * GET /api/trips/:tripId/transportation
 * Get transportation details for all days
 */
export const getTripTransportation = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await tripRepository.getTripWithItinerary(tripId, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  const transportationData = {
    totalDistance: 0,
    totalDuration: 0,
    totalCost: 0,
    days: [],
  };

  for (const day of trip.itinerary_days) {
    const activities = day.activities || [];

    if (activities.length < 2) {
      transportationData.days.push({
        dayId: day.id,
        date: day.date,
        dayNumber: day.day_number,
        totalDistance: 0,
        totalDuration: 0,
        totalCost: 0,
        segments: [],
      });
      continue;
    }

    const dayTransport = TransportationCalculator.calculateDayTransportation(
      activities.map(a => ({
        name: a.name,
        latitude: a.latitude,
        longitude: a.longitude,
      }))
    );

    transportationData.totalDistance += dayTransport.totalDistance;
    transportationData.totalDuration += dayTransport.totalDuration;
    transportationData.totalCost += dayTransport.totalCost;

    transportationData.days.push({
      dayId: day.id,
      date: day.date,
      dayNumber: day.day_number,
      ...dayTransport,
    });
  }

  return sendSuccess(res, transportationData);
});

/**
 * POST /api/trips/:tripId/recalculate-routes
 * Recalculate transportation after activity changes
 */
export const recalculateRoutes = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { dayIds } = req.body; // Optional: specific days to recalculate

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  const trip = await tripRepository.getTripWithItinerary(tripId, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  let updatedCount = 0;

  for (const day of trip.itinerary_days) {
    // Skip if specific days requested and this isn't one of them
    if (dayIds && !dayIds.includes(day.id)) {
      continue;
    }

    const activities = day.activities || [];

    if (activities.length < 2) {
      continue;
    }

    // Calculate transportation for all activities in this day
    const enrichedActivities = TransportationCalculator.enrichActivitiesWithTransport(
      activities.map(a => ({
        id: a.id,
        name: a.name,
        latitude: a.latitude,
        longitude: a.longitude,
      }))
    );

    // Update each activity with transportFromPrevious
    for (let i = 1; i < enrichedActivities.length; i++) {
      const activity = enrichedActivities[i];
      if (activity.transportFromPrevious) {
        await activityRepository.update(activity.id, {
          transportFromPrevious: activity.transportFromPrevious,
        });
        updatedCount++;
      }
    }
  }

  return sendSuccess(
    res,
    { updatedActivities: updatedCount },
    `Successfully recalculated transportation for ${updatedCount} activities`
  );
});

/**
 * GET /api/trips/:tripId/budget-breakdown
 * Get budget breakdown and compare with actual expenses
 */
export const getBudgetBreakdown = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await tripRepository.getTripById(tripId, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  const metadata = trip.metadata || {};
  const budgetBreakdown = metadata.budgetBreakdown || null;

  // Get actual expenses
  const expenses = await prisma.expenses.findMany({
    where: { trip_id: tripId },
    include: { expense_splits: true },
  });

  const actualByCategory = {
    accommodation: 0,
    food: 0,
    transportation: 0,
    activities: 0,
    miscellaneous: 0,
  };

  const categoryMap = {
    ACCOMMODATION: 'accommodation',
    FOOD: 'food',
    TRANSPORT: 'transportation',
    ACTIVITY: 'activities',
    OTHER: 'miscellaneous',
  };

  for (const expense of expenses) {
    const category = categoryMap[expense.category] || 'miscellaneous';
    actualByCategory[category] += parseFloat(expense.amount);
  }

  const result = {
    planned: budgetBreakdown,
    actual: actualByCategory,
    totalPlanned: budgetBreakdown
      ? Object.values(budgetBreakdown).reduce((sum, cat) => sum + (cat.total || 0), 0)
      : trip.budget_total || 0,
    totalActual: Object.values(actualByCategory).reduce((sum, val) => sum + val, 0),
    currency: trip.budget_currency || 'VND',
  };

  // Calculate differences
  if (budgetBreakdown) {
    result.differences = {};
    for (const [category, planned] of Object.entries(budgetBreakdown)) {
      const actual = actualByCategory[category] || 0;
      const diff = actual - (planned.total || 0);
      result.differences[category] = {
        planned: planned.total || 0,
        actual,
        difference: diff,
        percentage: planned.total ? ((diff / planned.total) * 100).toFixed(1) : 0,
      };
    }
  }

  return sendSuccess(res, result);
});

/**
 * GET /api/trips/:tripId/tips
 * Get travel tips by category
 */
export const getTravelTips = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const trip = await tripRepository.getTripById(tripId, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  const metadata = trip.metadata || {};
  const tips = metadata.tips || {
    general: [],
    transportation: [],
    food: [],
    safety: [],
    budget: [],
  };

  return sendSuccess(res, { tips });
});

/**
 * PUT /api/trips/:tripId/tips
 * Update travel tips
 */
export const updateTravelTips = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { tips } = req.body;

  if (!tips || typeof tips !== 'object') {
    throw AppError.badRequest('Tips must be an object with categories');
  }

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  const trip = await tripRepository.getTripById(tripId, req.user.id);
  const currentMetadata = trip.metadata || {};

  const updatedMetadata = {
    ...currentMetadata,
    tips,
  };

  await tripRepository.updateTrip(tripId, { metadata: updatedMetadata }, req.user.id);

  return sendSuccess(res, { tips }, 'Travel tips updated successfully');
});
