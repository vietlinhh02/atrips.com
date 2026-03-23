/**
 * Modify Trip With AI Use Case
 * Allows users to modify existing trips using natural language AI commands
 * 
 * FLOW: Step 7B - Modify Trip with AI
 */

import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import itineraryDayRepository from '../../infrastructure/repositories/ItineraryDayRepository.js';
import activityRepository from '../../infrastructure/repositories/ActivityRepository.js';
import tripService from '../services/TripService.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

export class ModifyTripWithAIUseCase {
  async execute({ tripId, message, userId, conversationId = null }) {
    logger.info('╔════════════════════════════════════════════════════════════╗');
    logger.info('║     STEP 7B: MODIFY TRIP WITH AI                           ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');
    logger.info(`Modification request: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    logger.info(`Trip ID: ${tripId}`);
    logger.info(`User ID: ${userId}`);

    await tripRepository.verifyTripOwnership(tripId, userId);
    logger.info('  Trip ownership verified');

    const trip = await tripRepository.getTripWithItinerary(tripId, userId);

    if (!trip) {
      console.log('  Trip not found');
      throw AppError.notFound('Trip not found');
    }
    
    const currentActivities = trip.itinerary_days?.reduce((sum, d) => 
      sum + (d.activities?.length || 0), 0) || 0;
    console.log(`  Current trip: "${trip.title}" (${trip.itinerary_days?.length || 0} days, ${currentActivities} activities)`);

    const context = {
      currentTrip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budget: trip.budget_total,
        currency: trip.budget_currency,
        travelers: trip.travelers_count,
      },
      userRequest: message,
      destination: trip.title,
      dates: { start: trip.start_date, end: trip.end_date },
      budget: trip.budget_total,
      existingActivities: trip.itinerary_days.flatMap(d =>
        d.activities.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          date: d.date,
          dayNumber: d.day_number,
        }))
      ),
    };

    logger.info('  Processing modification with AI...');
    
    let aiResponse;
    try {
      const AIService = (await import('../../../ai/infrastructure/services/AIService.js')).default;
      aiResponse = await AIService.chat(
        [{ role: 'user', content: message }],
        {
          context,
          taskType: 'modify_trip',
          enableTools: false,
        }
      );
    } catch (error) {
      throw AppError.internal('Failed to process AI request: ' + error.message);
    }

    logger.info('  AI processing complete');
    
    const changes = tripService.parseAIModifications(aiResponse.content);
    
    // Log detected changes
    logger.info('  Detected changes:');
    if (changes.extendDates) logger.info(`     • Extend dates to: ${changes.newEndDate}`);
    if (changes.updateTrip) logger.info(`     • Update trip fields: ${Object.keys(changes.updateTrip).join(', ')}`);
    if (changes.addActivities) logger.info(`     • Add ${changes.addActivities.length} activities`);
    if (changes.removeActivities) logger.info(`     • Remove ${changes.removeActivities.length} activities`);
    if (changes.updateActivities) logger.info(`     • Update ${changes.updateActivities.length} activities`);
    
    logger.info('  Applying changes...');

    if (changes.extendDates && changes.newEndDate) {
      await tripRepository.updateTrip(tripId, { endDate: changes.newEndDate }, userId);

      const oldEndDate = new Date(trip.end_date);
      const newEndDate = new Date(changes.newEndDate);
      if (newEndDate > oldEndDate) {
        const newDays = tripService.generateItineraryDays(
          oldEndDate.toISOString().split('T')[0],
          changes.newEndDate,
          trip.title
        );
        if (newDays.length > 1) {
          await itineraryDayRepository.createDays(tripId, newDays.slice(1));
        }
      }
    }

    if (changes.updateTrip) {
      await tripRepository.updateTrip(tripId, changes.updateTrip, userId);
    }

    if (changes.addActivities && changes.addActivities.length > 0) {
      for (const activity of changes.addActivities) {
        const dayId = activity.dayId || (await this.#findOrCreateDay(tripId, activity.date));
        await activityRepository.create({
          itineraryDayId: dayId,
          ...activity.data,
          createdById: userId,
        });
      }
    }

    if (changes.removeActivities && changes.removeActivities.length > 0) {
      await activityRepository.deleteMany(changes.removeActivities);
    }

    if (changes.updateActivities && changes.updateActivities.length > 0) {
      for (const { activityId, updates } of changes.updateActivities) {
        await activityRepository.update(activityId, updates);
      }
    }
    
    logger.info('  Changes applied successfully');

    if (conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'user',
          content: message,
        },
      });

      await prisma.aIMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse.content,
        },
      });
    }

    const updatedTrip = await tripRepository.getTripWithItinerary(tripId, userId);
    
    const newActivityCount = updatedTrip.itinerary_days?.reduce((sum, d) => 
      sum + (d.activities?.length || 0), 0) || 0;
    
    logger.info('  Trip updated:');
    logger.info(`     • Days: ${updatedTrip.itinerary_days?.length || 0}`);
    logger.info(`     • Activities: ${newActivityCount} (was ${currentActivities})`);
    
    logger.info('╔════════════════════════════════════════════════════════════╗');
    logger.info('║     STEP 7B: COMPLETED -                                   ║');
    logger.info('╚════════════════════════════════════════════════════════════╝');

    return {
      trip: updatedTrip,
      changes,
      message: 'Trip updated successfully',
    };
  }

  async #findOrCreateDay(tripId, date) {
    const days = await itineraryDayRepository.getDaysByTrip(tripId);
    const existingDay = days.find(d => d.date.toISOString().split('T')[0] === date);

    if (existingDay) {
      return existingDay.id;
    }

    const newDay = await itineraryDayRepository.createDay(tripId, {
      date,
      dayNumber: days.length + 1,
      title: `Day ${days.length + 1}`,
      notes: null,
    });

    return newDay.id;
  }
}

export default new ModifyTripWithAIUseCase();
