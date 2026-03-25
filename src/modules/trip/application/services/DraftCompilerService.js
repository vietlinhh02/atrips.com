/**
 * Draft Compiler Service
 * Converts AI semantic draft data into production-ready structured itinerary data.
 */

import crypto from 'node:crypto';
import prisma from '../../../../config/database.js';
import aiDraftRepository from '../../infrastructure/repositories/AIItineraryDraftRepository.js';
import googleMapsProvider from '../../../ai/infrastructure/services/GoogleMapsProvider.js';
import { logger } from '../../../../shared/services/LoggerService.js';
import placeEnrichmentService from '../../../place/application/services/PlaceEnrichmentService.js';

// Disabled by default — Serper Places already provides coordinates, ratings.
// Google Maps Playwright crawl adds 15-20s and often fails in Docker.
const GOOGLE_MAPS_HYDRATION_ENABLED = process.env.GOOGLE_MAPS_HYDRATION_ENABLED === 'true';

const DEFAULT_DURATION_BY_TYPE = {
  HOTEL: 60,
  RESTAURANT: 60,
  ATTRACTION: 120,
  TRANSPORT: 45,
  FLIGHT: 120,
  ACTIVITY: 90,
  CUSTOM: 60,
};

const DEFAULT_COST_BY_TYPE = {
  HOTEL: 350000,
  RESTAURANT: 70000,
  ATTRACTION: 120000,
  TRANSPORT: 50000,
  FLIGHT: 1800000,
  ACTIVITY: 100000,
  CUSTOM: 50000,
};

const ACTIVITY_TYPE_KEYWORDS = {
  HOTEL: ['hotel', 'khách sạn', 'resort', 'homestay', 'nhà nghỉ', 'stay', 'accommodation', 'lodging'],
  RESTAURANT: ['restaurant', 'quán', 'ăn', 'meal', 'food', 'cafe', 'coffee', 'chè', 'bún', 'hến', 'dining'],
  ATTRACTION: ['museum', 'bảo tàng', 'chùa', 'temple', 'landmark', 'đại nội', 'lăng', 'attraction', 'tham quan'],
  TRANSPORT: ['xe', 'bus', 'taxi', 'transport', 'move', 'di chuyển', 'shuttle'],
  FLIGHT: ['flight', 'airport', 'sân bay', 'bay'],
  ACTIVITY: ['activity', 'trải nghiệm', 'tour', 'check-in', 'walk', 'dạo', 'hiking'],
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const numeric = value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimeString(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }

  const raw = String(value).trim().toLowerCase();
  const rawNormalized = normalizeText(raw);
  const explicit = raw.match(/^(\d{1,2})[:h](\d{1,2})$/);
  if (explicit) {
    const hour = Number(explicit[1]);
    const minute = Number(explicit[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const hourOnly = raw.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, '0')}:00`;
    }
  }

  const vnTime = rawNormalized.match(/(\d{1,2})(?:[:h](\d{1,2}))?\s*(sang|trua|chieu|toi)/);
  if (vnTime) {
    let hour = Number(vnTime[1]);
    const minute = Number(vnTime[2] || 0);
    const period = vnTime[3];

    if (period === 'chieu' || period === 'toi') {
      if (hour < 12) hour += 12;
    }
    if (period === 'trua' && hour < 11) {
      hour += 12;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(11, 16);
  }

  return null;
}

function inferActivityType(activity = {}) {
  const explicit = normalizeText(activity.type);
  if (explicit) {
    if (explicit.includes('hotel') || explicit.includes('accommodation')) return 'HOTEL';
    if (explicit.includes('restaurant') || explicit.includes('dining') || explicit.includes('meal') || explicit.includes('food')) return 'RESTAURANT';
    if (explicit.includes('attraction') || explicit.includes('sightseeing')) return 'ATTRACTION';
    if (explicit.includes('transport')) return 'TRANSPORT';
    if (explicit.includes('flight')) return 'FLIGHT';
    if (explicit.includes('activity')) return 'ACTIVITY';
  }

  const text = normalizeText([
    activity.name,
    activity.title,
    activity.place,
    activity.suggestion,
    activity.description,
    activity.location,
    activity.address,
  ].filter(Boolean).join(' '));

  for (const [activityType, keywords] of Object.entries(ACTIVITY_TYPE_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(normalizeText(keyword)))) {
      return activityType;
    }
  }

  return 'CUSTOM';
}

function getCoordinates(activity) {
  const lat = typeof activity.latitude === 'number' ? activity.latitude : activity.coordinates?.lat;
  const lng = typeof activity.longitude === 'number' ? activity.longitude : activity.coordinates?.lng;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return { lat, lng };
  }
  return null;
}

function haversineDistanceKm(from, to) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
    Math.cos((to.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function inferTransport(fromCoords, toCoords) {
  const distance = haversineDistanceKm(fromCoords, toCoords);
  if (!Number.isFinite(distance)) return null;

  if (distance <= 1.2) {
    return {
      mode: 'WALK',
      distance: Number(distance.toFixed(1)),
      duration: Math.max(5, Math.round((distance / 4.5) * 60)),
      cost: 0,
      instructions: 'Di chuyển đi bộ giữa 2 điểm gần nhau.',
    };
  }

  if (distance <= 6) {
    return {
      mode: 'BIKE',
      distance: Number(distance.toFixed(1)),
      duration: Math.max(8, Math.round((distance / 15) * 60)),
      cost: 20000,
      instructions: 'Ưu tiên xe máy/xe đạp để tối ưu chi phí.',
    };
  }

  if (distance <= 25) {
    return {
      mode: 'TAXI',
      distance: Number(distance.toFixed(1)),
      duration: Math.max(15, Math.round((distance / 25) * 60)),
      cost: Math.round(distance * 12000),
      instructions: 'Gọi taxi hoặc xe công nghệ để tiết kiệm thời gian.',
    };
  }

  return {
    mode: 'CAR',
    distance: Number(distance.toFixed(1)),
    duration: Math.max(30, Math.round((distance / 45) * 60)),
    cost: Math.round(distance * 10000),
    instructions: 'Quãng đường xa, nên đi ô tô hoặc xe dịch vụ liên tỉnh.',
  };
}

function buildExternalId(provider, candidate) {
  const raw = `${provider}:${candidate.name || ''}:${candidate.address || ''}:${candidate.latitude || ''}:${candidate.longitude || ''}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 40);
}

function toPlaceType(activityType) {
  if (activityType === 'HOTEL') return 'HOTEL';
  if (activityType === 'RESTAURANT') return 'RESTAURANT';
  if (activityType === 'TRANSPORT') return 'TRANSPORT';
  if (activityType === 'ACTIVITY') return 'ACTIVITY';
  if (activityType === 'ATTRACTION') return 'ATTRACTION';
  return 'OTHER';
}

function mapCandidateFromCachedPlace(place) {
  return {
    id: place.id,
    source: place.provider,
    externalId: place.externalId,
    name: place.name,
    address: place.address,
    city: place.city,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    ratingCount: place.ratingCount,
    openingHours: place.openingHours,
    photos: place.photos || [],
  };
}

function mapCandidateFromGoogle(place) {
  return {
    id: null,
    source: place.source || 'google_maps',
    externalId: null,
    name: place.name,
    address: place.address,
    city: null,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    ratingCount: place.ratingCount,
    openingHours: place.openingHours,
    photos: place.photoUrl ? [place.photoUrl] : [],
  };
}

function scoreCandidate(candidate, context) {
  const nameNorm = normalizeText(candidate.name);
  const addressNorm = normalizeText(candidate.address);

  let score = 0;

  if (context.nameNorm && nameNorm === context.nameNorm) score += 80;
  if (context.nameNorm && nameNorm.includes(context.nameNorm)) score += 40;
  if (context.nameNorm && context.nameNorm.includes(nameNorm)) score += 30;

  if (context.locationNorm && addressNorm.includes(context.locationNorm)) score += 25;
  if (context.destinationNorm && addressNorm.includes(context.destinationNorm)) score += 15;

  if (candidate.rating) score += Math.min(candidate.rating * 2, 10);
  if (candidate.ratingCount) score += Math.min(Math.log10(candidate.ratingCount + 1) * 4, 8);

  return score;
}

function parseDraftJson(data) {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data;
}

export class DraftCompilerService {
  async compileDraftIfNeeded(draft) {
    const generatedData = parseDraftJson(draft.generatedData);

    if (draft.compileStatus === 'COMPLETED' && draft.compiledData) {
      return {
        compiledData: parseDraftJson(draft.compiledData),
        compileReport: draft.compileReport || null,
      };
    }

    await aiDraftRepository.markCompileProcessing(draft.id);

    try {
      const { compiledData, compileReport } = await this.#compileGeneratedData(generatedData);
      await aiDraftRepository.markCompileCompleted(draft.id, compiledData, compileReport);

      return { compiledData, compileReport };
    } catch (error) {
      const failedReport = {
        status: 'FAILED',
        message: error.message,
        failedAt: new Date().toISOString(),
      };
      await aiDraftRepository.markCompileFailed(draft.id, failedReport);
      throw error;
    }
  }

  async #compileGeneratedData(generatedData) {
    const compiled = JSON.parse(JSON.stringify(generatedData || {}));
    const days = Array.isArray(compiled.days) ? compiled.days : [];
    const destination = compiled.trip?.destination || compiled.destination || '';

    const report = {
      status: 'COMPLETED',
      totalDays: days.length,
      totalActivities: 0,
      placesResolved: 0,
      placesUnresolved: 0,
      imagesEnriched: 0,
      transportInferred: 0,
      timeNormalized: 0,
      costEstimated: 0,
      compiledAt: new Date().toISOString(),
    };

    // ── Pass 1: Normalize activities, resolve from cache, collect unresolved ──
    const unresolvedActivities = []; // { dayIdx, actIdx, activity, activityType }

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const listKey = Array.isArray(day.activities) ? 'activities' : 'schedule';
      const activities = Array.isArray(day[listKey]) ? day[listKey] : [];
      report.totalActivities += activities.length;

      for (let index = 0; index < activities.length; index++) {
        const activity = { ...activities[index] };
        activities[index] = activity; // replace with mutable copy
        const activityType = inferActivityType(activity);

        // Normalize time
        const normalizedTime = normalizeTimeString(activity.time || activity.startTime);
        if (normalizedTime && normalizedTime !== (activity.time || activity.startTime)) {
          report.timeNormalized += 1;
        }
        if (normalizedTime) {
          activity.time = normalizedTime;
          activity.startTime = normalizedTime;
        }

        const endTime = normalizeTimeString(activity.endTime);
        if (endTime) activity.endTime = endTime;

        // Normalize cost
        const cost = toNumber(activity.estimatedCost ?? activity.cost);
        if (cost == null) {
          activity.estimatedCost = DEFAULT_COST_BY_TYPE[activityType] || DEFAULT_COST_BY_TYPE.CUSTOM;
          report.costEstimated += 1;
        } else {
          activity.estimatedCost = cost;
        }

        // Normalize duration
        if (!activity.duration || !Number.isFinite(Number(activity.duration))) {
          activity.duration = DEFAULT_DURATION_BY_TYPE[activityType] || DEFAULT_DURATION_BY_TYPE.CUSTOM;
        }

        // Try cache first
        const resolvedPlace = await this.#searchCachedPlacesForActivity(activity, destination);
        if (resolvedPlace) {
          this.#applyResolvedPlace(activity, resolvedPlace, report);
        } else {
          // Collect for batch resolve
          unresolvedActivities.push({ dayIdx, actIdx: index, activity, activityType });
        }
      }
    }

    // ── Batch Google Maps resolve (ONE crawl for all unresolved) ──
    if (unresolvedActivities.length > 0 && destination && GOOGLE_MAPS_HYDRATION_ENABLED) {
      logger.info(`[DraftCompiler] Batch resolving ${unresolvedActivities.length} unresolved places for "${destination}"`);

      try {
        // Build a comprehensive search query from unresolved place names
        const uniqueNames = [...new Set(unresolvedActivities.map(u => {
          return u.activity.name || u.activity.title || u.activity.place || u.activity.suggestion;
        }).filter(Boolean))];

        // Do ONE crawl for the entire destination
        const searchResult = await googleMapsProvider.searchPlaces(destination, {
          query: `${uniqueNames.slice(0, 5).join(', ')} ${destination}`,
          limit: 30,
        });

        const googleCandidates = (searchResult.places || []).map(mapCandidateFromGoogle);

        if (googleCandidates.length > 0) {
          // Match each unresolved activity to the best Google candidate by name similarity
          for (const { activity, activityType } of unresolvedActivities) {
            const name = activity.name || activity.title || activity.place || activity.suggestion;
            const location = activity.address || activity.location || activity.customAddress;

            const context = {
              nameNorm: normalizeText(name),
              locationNorm: normalizeText(location),
              destinationNorm: normalizeText(destination),
            };

            const best = googleCandidates
              .map(candidate => ({ candidate, score: scoreCandidate(candidate, context) }))
              .sort((a, b) => b.score - a.score)[0];

            if (best?.candidate && best.score > 10) {
              const persisted = await this.#persistExternalCandidate(best.candidate, activityType, destination);
              if (persisted) {
                this.#applyResolvedPlace(activity, persisted, report);
              }
            } else {
              report.placesUnresolved += 1;
            }
          }
        } else {
          report.placesUnresolved += unresolvedActivities.length;
          logger.info(`[DraftCompiler] Batch Google Maps returned 0 places`);
        }
      } catch (error) {
        logger.warn(`[DraftCompiler] Batch place hydration failed: ${error.message}`);
        report.placesUnresolved += unresolvedActivities.length;
      }
    } else if (unresolvedActivities.length > 0) {
      report.placesUnresolved += unresolvedActivities.length;
    }

    // ── Pass 2: Infer transport between consecutive activities ──
    for (const day of days) {
      const listKey = Array.isArray(day.activities) ? 'activities' : 'schedule';
      const activities = Array.isArray(day[listKey]) ? day[listKey] : [];

      for (let index = 1; index < activities.length; index++) {
        const activity = activities[index];
        const previous = activities[index - 1];
        const hasTransport = !!activity.transportFromPrevious;

        if (!hasTransport) {
          const prevCoords = getCoordinates(previous);
          const currentCoords = getCoordinates(activity);

          if (prevCoords && currentCoords) {
            const inferred = inferTransport(prevCoords, currentCoords);
            if (inferred) {
              activity.transportFromPrevious = inferred;
              report.transportInferred += 1;
            }
          }
        }
      }

      const metadata = { ...(day.metadata || {}) };
      if (day.totalDistance != null) metadata.totalDistance = day.totalDistance;
      if (day.totalTravelTime != null) metadata.totalTravelTime = day.totalTravelTime;
      if (day.theme && !metadata.theme) metadata.theme = day.theme;
      if (Object.keys(metadata).length > 0) day.metadata = metadata;

      if (!day.weatherData && day.weather) {
        day.weatherData = day.weather;
      }
    }

    // ── Level 1 enrichment: link activities to cached_places via Serper ──
    const activitiesToEnrich = days
      .flatMap((day) => {
        const listKey = Array.isArray(day.activities) ? 'activities' : 'schedule';
        return Array.isArray(day[listKey]) ? day[listKey] : [];
      })
      .filter((a) => !a.placeId && a.name);

    if (activitiesToEnrich.length > 0) {
      try {
        const enrichResults = await placeEnrichmentService.enrichActivitiesBasic(
          activitiesToEnrich,
          destination
        );

        for (const result of enrichResults) {
          if (!result) continue;
          const activity = activitiesToEnrich.find((a) => a.name === result.activityName);
          if (activity) {
            activity.placeId = result.placeId;
            if (result.place.latitude) activity.latitude = result.place.latitude;
            if (result.place.longitude) activity.longitude = result.place.longitude;
            if (result.place.address) activity.customAddress = result.place.address;
          }
        }
      } catch (err) {
        logger.warn('[DraftCompiler] Enrichment failed, continuing without', {
          error: err.message,
        });
      }
    }

    compiled.compileStatus = 'COMPLETED';
    compiled.compiledAt = report.compiledAt;

    return {
      compiledData: compiled,
      compileReport: report,
    };
  }

  /**
   * Apply resolved place data to an activity
   */
  #applyResolvedPlace(activity, resolvedPlace, report) {
    report.placesResolved += 1;
    if (!activity.placeId && resolvedPlace.id) activity.placeId = resolvedPlace.id;

    if (!(typeof activity.latitude === 'number') && typeof resolvedPlace.latitude === 'number') {
      activity.latitude = resolvedPlace.latitude;
    }
    if (!(typeof activity.longitude === 'number') && typeof resolvedPlace.longitude === 'number') {
      activity.longitude = resolvedPlace.longitude;
    }

    if (!activity.coordinates && typeof activity.latitude === 'number' && typeof activity.longitude === 'number') {
      activity.coordinates = { lat: activity.latitude, lng: activity.longitude };
    }

    if (!activity.address && resolvedPlace.address) activity.address = resolvedPlace.address;
    if (!activity.location && resolvedPlace.address) activity.location = resolvedPlace.address;

    const existingGoogleInfo = activity.googleMapsInfo || {};
    activity.googleMapsInfo = {
      ...existingGoogleInfo,
      rating: existingGoogleInfo.rating ?? resolvedPlace.rating ?? null,
      ratingCount: existingGoogleInfo.ratingCount ?? resolvedPlace.ratingCount ?? null,
      openingHours: existingGoogleInfo.openingHours ?? resolvedPlace.openingHours ?? null,
      photos: existingGoogleInfo.photos?.length
        ? existingGoogleInfo.photos
        : (resolvedPlace.photos || []),
    };

    const primaryPhoto = activity.image || activity.imageUrl || activity.thumbnail;
    if (resolvedPlace.photos?.length) {
      if (!primaryPhoto) {
        activity.image = resolvedPlace.photos[0];
        activity.imageUrl = resolvedPlace.photos[0];
        activity.thumbnail = resolvedPlace.photos[0];
        report.imagesEnriched += 1;
      }
      // Always propagate full photos array for richer display
      if (!activity.photos || activity.photos.length === 0) {
        activity.photos = resolvedPlace.photos;
      }
    }
  }

  /**
   * Try to resolve a place from cached_places for a single activity
   */
  async #searchCachedPlacesForActivity(activity, destination) {
    const name = activity.name || activity.title || activity.place || activity.suggestion;
    const location = activity.address || activity.location || activity.customAddress;

    if (!name && !location) return null;

    const context = {
      nameNorm: normalizeText(name),
      locationNorm: normalizeText(location),
      destinationNorm: normalizeText(destination),
    };

    const cachedCandidates = await this.#searchCachedPlaces(name, location, destination);
    if (cachedCandidates.length > 0) {
      const best = cachedCandidates
        .map(candidate => ({ candidate, score: scoreCandidate(candidate, context) }))
        .sort((a, b) => b.score - a.score)[0];

      if (best?.candidate) {
        return best.candidate;
      }
    }

    return null;
  }

  async #resolvePlace(activity, destination, activityType) {
    const name = activity.name || activity.title || activity.place || activity.suggestion;
    const location = activity.address || activity.location || activity.customAddress;

    if (!name && !location) return null;

    const context = {
      nameNorm: normalizeText(name),
      locationNorm: normalizeText(location),
      destinationNorm: normalizeText(destination),
    };

    const cachedCandidates = await this.#searchCachedPlaces(name, location, destination);
    if (cachedCandidates.length > 0) {
      const best = cachedCandidates
        .map(candidate => ({ candidate, score: scoreCandidate(candidate, context) }))
        .sort((a, b) => b.score - a.score)[0];

      if (best?.candidate) {
        return best.candidate;
      }
    }

    if (!destination) {
      return null;
    }
    if (!GOOGLE_MAPS_HYDRATION_ENABLED) {
      return null;
    }

    try {
      const googleQuery = [name, location, destination].filter(Boolean).join(', ');
      const searchResult = await googleMapsProvider.searchPlaces(destination, {
        query: googleQuery,
        limit: 6,
      });

      const googleCandidates = (searchResult.places || []).map(mapCandidateFromGoogle);
      if (googleCandidates.length === 0) return null;

      const best = googleCandidates
        .map(candidate => ({ candidate, score: scoreCandidate(candidate, context) }))
        .sort((a, b) => b.score - a.score)[0];

      if (!best?.candidate) return null;
      return await this.#persistExternalCandidate(best.candidate, activityType, destination);
    } catch (error) {
      logger.warn(`[DraftCompiler] Place hydration failed for "${name || location}": ${error.message}`);
      return null;
    }
  }

  async #searchCachedPlaces(name, location, destination) {
    const orWhere = [];

    if (name) {
      orWhere.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (location) {
      orWhere.push({ address: { contains: location, mode: 'insensitive' } });
    }

    if (orWhere.length === 0) return [];

    const andWhere = [{ OR: orWhere }];

    if (destination) {
      andWhere.push({
        OR: [
          { city: { contains: destination, mode: 'insensitive' } },
          { address: { contains: destination, mode: 'insensitive' } },
        ],
      });
    }

    const places = await prisma.cached_places.findMany({
      where: { AND: andWhere },
      orderBy: [
        { rating: 'desc' },
        { ratingCount: 'desc' },
      ],
      take: 8,
      select: {
        id: true,
        provider: true,
        externalId: true,
        name: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        rating: true,
        ratingCount: true,
        openingHours: true,
        photos: true,
      },
    });

    return places.map(mapCandidateFromCachedPlace);
  }

  async #persistExternalCandidate(candidate, activityType, destination) {
    if (!(typeof candidate.latitude === 'number') || !(typeof candidate.longitude === 'number')) {
      return candidate;
    }

    const provider = candidate.source || 'google_maps';
    const externalId = candidate.externalId || buildExternalId(provider, candidate);

    const place = await prisma.cached_places.upsert({
      where: {
        provider_externalId: {
          provider,
          externalId,
        },
      },
      create: {
        provider,
        externalId,
        name: candidate.name || 'Unnamed place',
        type: toPlaceType(activityType),
        address: candidate.address || null,
        city: destination || null,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        rating: candidate.rating || null,
        ratingCount: candidate.ratingCount || null,
        openingHours: candidate.openingHours || null,
        photos: candidate.photos || [],
      },
      update: {
        name: candidate.name || undefined,
        address: candidate.address || undefined,
        city: destination || undefined,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        rating: candidate.rating || undefined,
        ratingCount: candidate.ratingCount || undefined,
        openingHours: candidate.openingHours || undefined,
        photos: candidate.photos?.length ? candidate.photos : undefined,
        lastFetchedAt: new Date(),
      },
    });

    return mapCandidateFromCachedPlace(place);
  }
}

export default new DraftCompilerService();
