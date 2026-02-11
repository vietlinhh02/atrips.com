/**
 * Apply AI Draft Use Case
 * Converts AI-generated drafts into actual trips with itineraries
 * 
 * FLOW: Step 7A - Apply Draft → Create Trip
 *       Step 8 - Trip Ready
 */

import aiDraftRepository from '../../infrastructure/repositories/AIItineraryDraftRepository.js';
import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import itineraryDayRepository from '../../infrastructure/repositories/ItineraryDayRepository.js';
import activityRepository from '../../infrastructure/repositories/ActivityRepository.js';
import tripService from '../services/TripService.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

export class ApplyAIDraftUseCase {
  async execute({ draftId, userId, createNew = true, existingTripId = null }) {
    logger.info('╔════════════════════════════════════════════════════════════╗');
    logger.info('║     STEP 7A: APPLY DRAFT → CREATE TRIP                     ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');
    logger.info(`Draft ID: ${draftId}`);
    logger.info(`User ID: ${userId}`);
    logger.info(`Create new: ${createNew}`);
    
    const draft = await aiDraftRepository.getDraftById(draftId);

    if (!draft) {
      logger.error('Draft not found');
      throw AppError.notFound('Draft not found');
    }

    if (draft.conversation && draft.conversation.user_id !== userId) {
      logger.error('User does not have access to this draft');
      throw AppError.forbidden('You do not have access to this draft');
    }

    if (draft.applied_at) {
      logger.error('Draft has already been applied');
      throw AppError.badRequest('Draft has already been applied');
    }

    logger.info('  Parsing draft data...');
    const tripData = tripService.parseAIDraftToTripData(draft.generated_data);
    logger.info(`  - Trip title: ${tripData.title || 'N/A'}`);
    logger.info(`  - Destination: ${tripData.destination || 'N/A'}`);

    // Phase 1: Extract additional data
    const draftContent = typeof draft.generated_data === 'string'
      ? JSON.parse(draft.generated_data)
      : draft.generated_data;

    const phase1Data = {
      overview: draftContent.overview || null,
      travelTips: draftContent.travelTips || null,
      budgetBreakdown: draftContent.budgetBreakdown || null,
      bookingSuggestions: draftContent.bookingSuggestions || null,
    };

    if (phase1Data.overview) logger.info('  - Phase 1: Overview data found');
    if (phase1Data.travelTips) logger.info('  - Phase 1: Travel tips found');
    if (phase1Data.budgetBreakdown) logger.info('  - Phase 1: Budget breakdown found');
    if (phase1Data.bookingSuggestions) logger.info(`  - Phase 1: ${phase1Data.bookingSuggestions.length} booking suggestions found`);

    let trip;
    if (createNew) {
      logger.info('  Creating new Trip record...');

      // Phase 1: Merge Phase 1 data into tripData
      const tripDataWithPhase1 = {
        ...tripData,
        overview: phase1Data.overview,
        metadata: {
          tips: phase1Data.travelTips,
          budgetBreakdown: phase1Data.budgetBreakdown,
        },
      };

      trip = await tripRepository.createTrip(tripDataWithPhase1, userId);
      logger.info(`  Trip created: ${trip.id}`);

      // Phase 1: Create bookings if suggestions exist
      if (phase1Data.bookingSuggestions && phase1Data.bookingSuggestions.length > 0) {
        logger.info(`  Creating ${phase1Data.bookingSuggestions.length} booking records...`);
        for (const booking of phase1Data.bookingSuggestions) {
          try {
            await prisma.trip_bookings.create({
              data: {
                tripId: trip.id,
                bookingType: booking.type || 'OTHER',
                title: booking.title,
                provider: booking.provider || null,
                bookingUrl: booking.bookingUrl || null,
                status: 'PENDING',
                totalCost: booking.estimatedCost || null,
                currency: booking.currency || 'VND',
                checkInDate: booking.checkIn ? new Date(booking.checkIn) : null,
                checkOutDate: booking.checkOut ? new Date(booking.checkOut) : null,
                notes: booking.notes || null,
              },
            });
          } catch (bookingError) {
            logger.warn(`  Failed to create booking: ${booking.title}`, { error: bookingError.message });
          }
        }
        logger.info('  Bookings created successfully');
      }
    } else {
      if (!existingTripId) {
        throw AppError.badRequest('existingTripId is required when createNew is false');
      }
      logger.info(`  Updating existing trip: ${existingTripId}`);
      trip = await tripRepository.updateTrip(existingTripId, tripData, userId);
      logger.info(`  Trip updated: ${trip.id}`);
    }

    const generatedData = typeof draft.generated_data === 'string'
      ? JSON.parse(draft.generated_data)
      : draft.generated_data;

    // ═══════════════════════════════════════════════════════════════
    // Create Itinerary Days and Activities
    // ═══════════════════════════════════════════════════════════════
    logger.info('  Creating Itinerary Days...');
    
    if (generatedData.days && Array.isArray(generatedData.days)) {
      logger.info(`     Total days to create: ${generatedData.days.length}`);
      
      for (let dayIndex = 0; dayIndex < generatedData.days.length; dayIndex++) {
        const dayData = generatedData.days[dayIndex];
        logger.info(`     Day ${dayIndex + 1}:`);
        
        const day = await itineraryDayRepository.createDay(trip.id, {
          date: dayData.date,
          dayNumber: dayData.dayNumber || dayData.day,
          title: dayData.title || dayData.theme || `Day ${dayData.dayNumber || dayData.day}`,
          notes: dayData.notes || dayData.theme || null,
        });
        logger.info(`       - Created day: ${day.id}`);

        // Support both 'schedule' and 'activities' field names
        const activitiesList = dayData.schedule || dayData.activities;
        if (activitiesList && Array.isArray(activitiesList)) {
          logger.info(`       → Creating ${activitiesList.length} activities...`);
          
          for (let index = 0; index < activitiesList.length; index++) {
            const activityData = activitiesList[index];
            const placeData = tripService.extractPlaceData(activityData);

            await activityRepository.create({
              itineraryDayId: day.id,
              name: placeData.name,
              type: tripService.mapActivityTypeFromAI(activityData.type),
              description: placeData.description,
              startTime: activityData.time || activityData.startTime || null,
              endTime: activityData.endTime || null,
              duration: placeData.duration,
              placeId: placeData.placeId,
              placeName: placeData.name,
              customAddress: placeData.address,
              latitude: placeData.latitude,
              longitude: placeData.longitude,
              estimatedCost: placeData.estimatedCost,
              orderIndex: activityData.orderIndex !== undefined ? activityData.orderIndex : index,
              transportFromPrevious: activityData.transportFromPrevious || null, // Phase 1
              createdById: userId,
            });
          }
          logger.info(`       - Created ${activitiesList.length} activities`);
        }
      }
    } else {
      logger.warn('     No days data found in draft');
    }

    // ═══════════════════════════════════════════════════════════════
    // Mark draft as applied and link conversation
    // ═══════════════════════════════════════════════════════════════
    logger.info('  Marking draft as applied...');
    await aiDraftRepository.markDraftAsApplied(draftId, trip.id);
    logger.info(`  Draft ${draftId} marked as applied to trip ${trip.id}`);

    // Link conversation to the created trip
    if (draft.conversationId) {
      logger.info(`  Linking conversation ${draft.conversationId} to trip...`);
      await prisma.ai_conversations.update({
        where: { id: draft.conversationId },
        data: { tripId: trip.id },
      });
      logger.info('  Conversation linked');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: TRIP READY
    // ═══════════════════════════════════════════════════════════════
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('STEP 8: TRIP READY');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const fullTrip = await tripRepository.getTripWithItinerary(trip.id, userId);
    const totalDays = fullTrip.itinerary_days?.length || 0;
    const totalActivities = fullTrip.itinerary_days?.reduce((sum, day) => 
      sum + (day.activities?.length || 0), 0) || 0;
    
    logger.info(`  TRIP CREATED SUCCESSFULLY!`);
    logger.info(`  Trip ID: ${trip.id}`);
    logger.info(`  Title: ${fullTrip.title}`);
    logger.info(`  Days: ${totalDays}`);
    logger.info(`  Activities: ${totalActivities}`);
    logger.info('  User can now:');
    logger.info(`     • View trip: GET /api/trips/${trip.id}`);
    logger.info(`     • Edit activities manually`);
    logger.info(`     • Share trip with others`);
    logger.info(`     • Export to calendar/PDF`);
    
    logger.info('╔════════════════════════════════════════════════════════════╗');
    logger.info('║     STEP 7A & 8: COMPLETED -                               ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    return {
      trip: fullTrip,
      message: 'Draft applied successfully',
    };
  }
}

export default new ApplyAIDraftUseCase();
