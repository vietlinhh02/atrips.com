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
import draftCompilerService from '../services/DraftCompilerService.js';
import imageQueueService from '../../../image/infrastructure/services/ImageQueueService.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const VALID_BOOKING_TYPES = new Set([
  'HOTEL', 'FLIGHT', 'RESTAURANT', 'TOUR', 'TRANSPORT', 'OTHER',
]);
const BOOKING_TYPE_ALIASES = { activity: 'TOUR', tour: 'TOUR' };

function normalizeBookingType(raw) {
  if (!raw) return 'OTHER';
  const upper = raw.toUpperCase();
  if (VALID_BOOKING_TYPES.has(upper)) return upper;
  return BOOKING_TYPE_ALIASES[raw.toLowerCase()] || 'OTHER';
}

/**
 * Extract the city name from a day's first activity address.
 * e.g. "Ubud, Gianyar" → "Ubud" | "Jl. Monkey Forest, Ubud" → "Ubud"
 */
function extractCityFromDay(dayData) {
  const activities = dayData.schedule || dayData.activities || [];
  for (const act of activities) {
    const addr = act.address || act.location || act.customAddress;
    if (!addr || typeof addr !== 'string') continue;
    const parts = addr.split(',').map((p) => p.trim());
    // If first part looks like a street (starts with Jl./Jalan/No.), use second part
    if (parts.length > 1 && /^(jl\.|jalan|no\.|gang)/i.test(parts[0])) {
      return parts[1] || parts[0];
    }
    return parts[0];
  }
  return null;
}

/**
 * Get a cover image URL for the destination using curated Unsplash photos.
 */
function getDestinationCoverImage(destination) {
  if (!destination) return null;
  const dest = destination.toLowerCase();
  const covers = {
    bali: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1200&q=80',
    'da lat': 'https://images.unsplash.com/photo-1566195992011-5f6b21e539aa?auto=format&fit=crop&w=1200&q=80',
    dalat: 'https://images.unsplash.com/photo-1566195992011-5f6b21e539aa?auto=format&fit=crop&w=1200&q=80',
    'phu quoc': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80',
    'hoi an': 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=80',
    hanoi: 'https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1200&q=80',
    'ha noi': 'https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1200&q=80',
    'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80',
    bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=80',
    tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
  };
  for (const [key, url] of Object.entries(covers)) {
    if (dest.includes(key)) return url;
  }
  // Generic travel fallback
  return 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';
}

/**
 * Detect image source provider from URL
 */
function detectImageProvider(url) {
  if (!url || typeof url !== 'string') return 'PEXELS';
  if (url.includes('googleusercontent.com') || url.includes('google.com/maps')) return 'GOOGLE_MAPS';
  if (url.includes('pexels.com')) return 'PEXELS';
  if (url.includes('unsplash.com')) return 'UNSPLASH';
  if (url.includes('picsum.photos')) return 'PICSUM';
  if (url.includes('mapbox.com')) return 'MAPBOX';
  return 'PEXELS';
}

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

    if (draft.ai_conversations && draft.ai_conversations.userId !== userId) {
      logger.error('User does not have access to this draft');
      throw AppError.forbidden('You do not have access to this draft');
    }

    if (draft.appliedAt) {
      logger.error('Draft has already been applied');
      throw AppError.badRequest('Draft has already been applied');
    }

    logger.info('  Compiling draft into production-ready data...');
    let compiledData;
    try {
      const compileResult = await draftCompilerService.compileDraftIfNeeded(draft);
      compiledData = compileResult.compiledData;
      if (compileResult.compileReport) {
        logger.info(`  - Compile status: ${compileResult.compileReport.status || 'COMPLETED'}`);
        logger.info(`  - Places resolved: ${compileResult.compileReport.placesResolved || 0}/${compileResult.compileReport.totalActivities || 0}`);
      }
    } catch (compileError) {
      logger.error(`  Draft compile failed: ${compileError.message}`);
      throw AppError.badRequest('Không thể chuẩn hóa draft thành dữ liệu trip. Vui lòng tạo lại kế hoạch hoặc thử lại.');
    }

    logger.info('  Parsing draft data...');
    const tripData = tripService.parseAIDraftToTripData(compiledData);
    logger.info(`  - Trip title: ${tripData.title || 'N/A'}`);
    logger.info(`  - Destination: ${tripData.destination || 'N/A'}`);

    // Phase 1: Extract additional data
    const draftContent = typeof compiledData === 'string'
      ? JSON.parse(compiledData)
      : compiledData;

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
        // Set cover image from destination if not provided
        coverImageUrl: tripData.coverImageUrl || getDestinationCoverImage(tripData.destination),
      };

      logger.info('  tripDataWithPhase1:', JSON.stringify(tripDataWithPhase1, null, 2));
      trip = await tripRepository.createTrip(tripDataWithPhase1, userId);
      logger.info(`  Trip created: ${trip?.id || 'NULL'}`);

      // Phase 1: Create bookings if suggestions exist
      if (phase1Data.bookingSuggestions && phase1Data.bookingSuggestions.length > 0) {
        logger.info(`  Creating ${phase1Data.bookingSuggestions.length} booking records...`);
        for (const booking of phase1Data.bookingSuggestions) {
          try {
            await prisma.trip_bookings.create({
              data: {
                tripId: trip.id,
                bookingType: normalizeBookingType(booking.type),
                title: booking.title || booking.name || `${booking.type || 'Booking'} suggestion`,
                provider: booking.provider || null,
                bookingUrl: booking.bookingUrl || null,
                status: 'PENDING',
                totalCost: booking.estimatedCost || null,
                currency: booking.currency || 'VND',
                checkInDate: booking.checkIn ? new Date(booking.checkIn) : null,
                checkOutDate: booking.checkOut ? new Date(booking.checkOut) : null,
                description: booking.notes || booking.reason || null,
              },
            });
          } catch (bookingError) {
            logger.warn(`  Failed to create booking: ${booking.title || booking.name}`, { error: bookingError.message });
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

    const generatedData = typeof compiledData === 'string'
      ? JSON.parse(compiledData)
      : compiledData;

    // Extract currency from draft top-level (AI returns currency at root, e.g. "VND")
    const activityCurrency = generatedData.currency || tripData.budgetCurrency || 'VND';

    // ═══════════════════════════════════════════════════════════════
    // Create Itinerary Days and Activities
    // ═══════════════════════════════════════════════════════════════
    logger.info('  Creating Itinerary Days...');

    // Track created activities for image ingestion
    const createdActivities = [];

    if (generatedData.days && Array.isArray(generatedData.days)) {
      logger.info(`     Total days to create: ${generatedData.days.length}`);

      for (let dayIndex = 0; dayIndex < generatedData.days.length; dayIndex++) {
        const dayData = generatedData.days[dayIndex];
        logger.info(`     Day ${dayIndex + 1}:`);

        const day = await itineraryDayRepository.createDay(trip.id, {
          date: dayData.date,
          dayNumber: dayData.dayNumber || dayData.day || (dayIndex + 1),
          notes: dayData.notes || dayData.theme || dayData.title || null,
          cityName: dayData.location || dayData.city || extractCityFromDay(dayData),
          weatherData: dayData.weatherData || dayData.weather || null,
          metadata: dayData.metadata || {
            ...(dayData.totalDistance != null ? { totalDistance: dayData.totalDistance } : {}),
            ...(dayData.totalTravelTime != null ? { totalTravelTime: dayData.totalTravelTime } : {}),
            ...(dayData.theme ? { theme: dayData.theme } : {}),
          },
        });
        logger.info(`       - Created day: ${day.id}`);

        // Support both 'schedule' and 'activities' field names
        const activitiesList = dayData.schedule || dayData.activities;
        if (activitiesList && Array.isArray(activitiesList)) {
          logger.info(`       → Creating ${activitiesList.length} activities...`);

          for (let index = 0; index < activitiesList.length; index++) {
            const activityData = activitiesList[index];
            const placeData = tripService.extractPlaceData(activityData);

            const createdActivity = await activityRepository.create({
              itineraryDayId: day.id,
              name: placeData.name,
              type: tripService.mapActivityTypeFromAI(activityData.type),
              description: placeData.description,
              startTime: activityData.time || activityData.startTime || null,
              endTime: activityData.endTime || null,
              duration: placeData.duration,
              placeId: placeData.placeId,
              customAddress: placeData.address,
              latitude: placeData.latitude,
              longitude: placeData.longitude,
              estimatedCost: placeData.estimatedCost,
              currency: activityData.currency || activityCurrency,
              notes: activityData.tips || activityData.notes || null,
              bookingUrl: activityData.bookingUrl || null,
              orderIndex: activityData.orderIndex !== undefined ? activityData.orderIndex : index,
              transportFromPrevious: activityData.transportFromPrevious || null,
              createdById: userId,
            });

            // Track for image ingestion
            const imageUrl = activityData.image || activityData.imageUrl
              || activityData.photos?.[0] || activityData.thumbnail || null;
            if (imageUrl) {
              createdActivities.push({
                activityId: createdActivity.id,
                imageUrl,
                sourceProvider: activityData.sourceProvider || detectImageProvider(imageUrl),
              });
            }
          }
          logger.info(`       - Created ${activitiesList.length} activities`);
        }
      }
    } else {
      logger.warn('     No days data found in draft');
    }

    // ═══════════════════════════════════════════════════════════════
    // Queue image ingestion jobs (fire-and-forget)
    // ═══════════════════════════════════════════════════════════════
    if (imageQueueService.isReady && (createdActivities.length > 0 || trip.coverImageUrl)) {
      const imageJobs = createdActivities.map(({ activityId, imageUrl, sourceProvider }) => ({
        sourceUrl: imageUrl,
        sourceProvider,
        entityType: 'activity',
        entityId: activityId,
      }));

      // Trip cover image
      const coverUrl = generatedData.coverImageUrl || tripData.coverImageUrl;
      if (coverUrl) {
        imageJobs.push({
          sourceUrl: coverUrl,
          sourceProvider: detectImageProvider(coverUrl),
          entityType: 'trip_cover',
          entityId: trip.id,
        });
      }

      if (imageJobs.length > 0) {
        imageQueueService.addBulk(imageJobs).catch(err => {
          logger.warn(`[ImageQueue] Failed to queue ${imageJobs.length} jobs: ${err.message}`);
        });
        logger.info(`  Queued ${imageJobs.length} image ingest jobs`);
      }
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
