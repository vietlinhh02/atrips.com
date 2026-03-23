/**
 * Planning Handlers
 * Handles trip plan creation and itinerary enrichment
 */

import aiDraftRepository from '../../../../trip/infrastructure/repositories/AIItineraryDraftRepository.js';
import applyAIDraftUseCase from '../../../../trip/application/useCases/ApplyAIDraftUseCase.js';
import { logger } from '../../../../../shared/services/LoggerService.js';
import prisma from '../../../../../config/database.js';
import { TripPlanner } from '../../../domain/algorithms/TripPlannerService.js';
import { haversineDistance } from '../../../domain/algorithms/TSPSolver.js';
import googleMapsProvider from '../GoogleMapsProvider.js';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const imageCache = new Map();

/**
 * Create planning handlers bound to executor context
 */
export function createPlanningHandlers(executor) {
  return {
    optimizeItinerary: optimizeItinerary.bind(executor),
    createTripPlan: createTripPlan.bind(executor),
  };
}

/**
 * Estimate visit duration by place type
 */
function estimateDuration(type) {
  const durations = {
    ATTRACTION: 90,
    RESTAURANT: 60,
    HOTEL: 30,
    CAFE: 45,
    ACTIVITY: 120,
    MUSEUM: 120,
    SHOPPING: 60,
    OTHER: 60,
  };
  return durations[type] || 60;
}

/**
 * Estimate cost by place type and travel style
 */
function estimateCost(type, style) {
  const baseCosts = {
    ATTRACTION: 100000,
    RESTAURANT: 200000,
    CAFE: 50000,
    ACTIVITY: 300000,
    MUSEUM: 50000,
    SHOPPING: 500000,
    OTHER: 100000,
  };
  const styleMultipliers = {
    budget: 0.5,
    comfort: 1.0,
    luxury: 2.5,
  };
  const base = baseCosts[type] || 100000;
  const multiplier = styleMultipliers[style] || 1.0;
  return Math.round(base * multiplier);
}

function normalizeGeoText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Deduplicate places across sources by name similarity + coordinate proximity.
 * Keeps the richer record (more fields filled).
 */
function deduplicatePlaces(places) {
  const seen = new Map(); // normalizedName → best place
  const result = [];

  for (const place of places) {
    const normName = normalizeGeoText(place.name).replace(/[^a-z0-9\s]/g, '').trim();
    if (!normName || normName.length < 2) continue;

    const existing = seen.get(normName);
    if (existing) {
      // Merge: keep fields from the richer record
      if (place.rating != null && existing.rating == null) existing.rating = place.rating;
      if (place.ratingCount != null && existing.ratingCount == null) existing.ratingCount = place.ratingCount;
      if (place.openingHours && !existing.openingHours) existing.openingHours = place.openingHours;
      if (place.phone && !existing.phone) existing.phone = place.phone;
      if (place.address && !existing.address) existing.address = place.address;
      if (place.latitude && !existing.latitude) { existing.latitude = place.latitude; existing.longitude = place.longitude; }
      if (place.photos?.length && !existing.photos?.length) existing.photos = place.photos;
      // Prefer google_maps source for richer data
      if (place.source === 'google_maps' && existing.source !== 'google_maps') {
        existing.source = place.source;
        if (place.website) existing.website = place.website;
      }
      continue;
    }

    // Check for partial name matches (one name contains the other)
    let merged = false;
    for (const [key, ex] of seen) {
      const shorter = Math.min(key.length, normName.length);
      const longer = Math.max(key.length, normName.length);
      if (shorter >= 4 && shorter / longer >= 0.7 && (key.includes(normName) || normName.includes(key))) {
        // Also check coordinate proximity if both have coords
        if (ex.latitude && place.latitude) {
          const dist = haversineDistance({ lat: ex.latitude, lng: ex.longitude }, { lat: place.latitude, lng: place.longitude });
          if (dist > 2) continue; // Different places with similar names
        }
        // Merge into existing
        if (place.rating != null && ex.rating == null) ex.rating = place.rating;
        if (place.ratingCount != null && ex.ratingCount == null) ex.ratingCount = place.ratingCount;
        if (place.latitude && !ex.latitude) { ex.latitude = place.latitude; ex.longitude = place.longitude; }
        merged = true;
        break;
      }
    }
    if (merged) continue;

    seen.set(normName, place);
    result.push(place);
  }

  return result;
}

/**
 * Filter out low-quality places: street names, district/city names, generic locations.
 * Uses data-driven signals instead of hardcoded names so it works for any destination.
 */
function filterLowQualityPlaces(places) {
  // Vietnamese street/alley prefixes — these are street names, not POIs
  const streetPrefixesNorm = [
    'pho ', 'duong ', 'ngo ', 'hem ', 'cau ',
  ];
  // Original Vietnamese (pre-NFD) for names that haven't been normalized yet
  const streetPrefixesVi = [
    'phố ', 'đường ', 'ngõ ', 'hẻm ', 'cầu ',
  ];

  // Mapbox place_type values that indicate administrative areas, not POIs
  // (When available — Mapbox external search may attach these in metadata)
  const adminPlaceTypes = new Set([
    'region', 'district', 'place', 'locality', 'neighborhood', 'country',
  ]);

  return places.filter(place => {
    const name = (place.name || '').trim();
    if (name.length < 3) return false;

    const normName = normalizeGeoText(name);
    const nameLower = name.toLowerCase();

    // 1. Filter street names by prefix (works for all Vietnamese cities)
    //    Keep the place if it has at least one useful signal (rating, ratingCount, phone, or photos)
    const hasAnySignal = place.rating || place.ratingCount || place.phone || place.photos?.length;
    let matchesStreetPrefix = false;
    for (const prefix of streetPrefixesNorm) {
      if (normName.startsWith(prefix)) { matchesStreetPrefix = true; break; }
    }
    if (!matchesStreetPrefix) {
      for (const prefix of streetPrefixesVi) {
        if (nameLower.startsWith(prefix)) { matchesStreetPrefix = true; break; }
      }
    }
    if (matchesStreetPrefix && !hasAnySignal) return false;

    // 2. Filter by "đường nội khu" pattern (internal roads in housing complexes)
    if (normName.startsWith('duong noi khu')) return false;

    // 3. Data-driven: places from mapbox/cache with NO rating, NO ratingCount,
    //    NO phone, NO photos, and short name → almost certainly an administrative area
    //    (real POIs from Google Maps always have at least a rating or ratingCount)
    if (place.source !== 'google_maps' && place.source !== 'database') {
      const hasNoQualitySignals = !place.rating && !place.ratingCount && !place.phone;
      const hasNoPhotos = !place.photos?.length && !place.photoUrl;
      const isShortGenericName = name.length < 20 && !name.includes(' - ') && !/\d/.test(name);

      if (hasNoQualitySignals && hasNoPhotos && isShortGenericName) {
        return false;
      }
    }

    // 4. Filter places whose address IS the same as the name
    //    (e.g., name="Bắc Từ Liêm", address="Bắc Từ Liêm, Hà Nội, Việt Nam")
    if (place.address) {
      const addrNorm = normalizeGeoText(place.address);
      if (addrNorm.startsWith(normName + ',') || addrNorm === normName) {
        // Address starts with the place name → likely an area, not a POI
        const hasNoQualitySignals = !place.rating && !place.ratingCount;
        if (hasNoQualitySignals) return false;
      }
    }

    return true;
  });
}

/**
 * Trim place data to only fields the AI needs for trip planning.
 * Removes long URLs, rawText, photos to save tokens.
 */
function trimPlaceForAI(place) {
  return {
    name: place.name,
    type: place.type,
    address: place.address || null,
    rating: place.rating || null,
    ratingCount: place.ratingCount || null,
    estimatedDuration: place.duration || place.estimatedDuration || 60,
    estimatedCost: place.cost || place.estimatedCost || 0,
    source: place.source || null,
    coordinates: (place.latitude && place.longitude)
      ? { lat: place.latitude, lng: place.longitude }
      : (place.coordinates || null),
    // Only include opening hours text, not full object
    openingHours: place.openingHours?.text || (typeof place.openingHours === 'string' ? place.openingHours : null),
    // Only include first photo URL for reference, not all
    photo: place.photos?.[0] || place.photoUrl || null,
  };
}

/**
 * Trim Google Maps raw data for AI context — keep only enrichment-relevant fields.
 */
function trimGoogleMapsDataForAI(gmData) {
  if (!gmData || gmData.length === 0) return undefined;
  return gmData
    .filter(p => p.enrichedDetail || p.reviewSnippet || p.description)
    .slice(0, 10)
    .map(p => ({
      name: p.name,
      description: p.description || null,
      reviewSnippet: p.reviewSnippet || null,
      // Only include enriched detail summary, not full raw data
      ...(p.enrichedDetail ? {
        about: p.enrichedDetail.rawAbout?.substring(0, 200) || null,
        amenities: p.enrichedDetail.rawAmenities?.substring(0, 100) || null,
        photos: p.enrichedDetail.allPhotoUrls?.slice(0, 3) || null,
      } : {}),
    }));
}

function getCountryBiasFromDestination(destination = '') {
  const norm = normalizeGeoText(destination);
  if (!norm) return null;

  // Explicit signals first
  if (norm.includes('viet nam') || norm.includes('vietnam')) return 'VN';

  // Fallback: common Vietnam destinations/provinces written without country suffix
  const vnHints = [
    'ha noi', 'ho chi minh', 'da nang', 'hue', 'hoi an', 'da lat',
    'nha trang', 'phu quoc', 'sapa', 'ha long', 'quang binh',
    'dong hoi', 'can tho', 'hai phong', 'vung tau',
  ];
  if (vnHints.some(h => norm.includes(h))) return 'VN';

  return null;
}

function buildDestinationGeocodeQueries(destination) {
  const primary = String(destination || '').trim();
  const core = primary.split(',')[0]?.trim() || primary;
  const candidates = [
    primary,
    `${core}, Vietnam`,
    `${core} province, Vietnam`,
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function pickBestDestinationFeature(features, destination) {
  if (!Array.isArray(features) || features.length === 0) return null;

  const destNorm = normalizeGeoText(destination);
  const destCoreNorm = normalizeGeoText(String(destination || '').split(',')[0] || destination);
  let best = null;
  let bestScore = -Infinity;

  for (const feature of features) {
    let score = 0;
    const placeNameNorm = normalizeGeoText(feature?.place_name || '');
    const placeType = feature?.place_type?.[0];
    const context = Array.isArray(feature?.context) ? feature.context : [];

    if (placeType === 'region') score += 30;
    if (placeType === 'district') score += 12;
    if (placeType === 'place') score += 10;
    if (placeType === 'locality') score += 8;

    if (destCoreNorm && placeNameNorm.includes(destCoreNorm)) score += 15;
    if (destNorm && placeNameNorm.includes(destNorm)) score += 8;

    const hasVietnamContext = context.some(c =>
      String(c?.id || '').startsWith('country.') &&
      (c?.short_code === 'vn' || normalizeGeoText(c?.text || '').includes('viet nam'))
    );
    if (hasVietnamContext) score += 10;

    if (score > bestScore) {
      best = feature;
      bestScore = score;
    }
  }

  return best || features[0];
}

async function geocodeDestinationCenter(destination, mapboxToken) {
  if (!destination || !mapboxToken) return null;

  const countryBias = getCountryBiasFromDestination(destination);
  const queries = buildDestinationGeocodeQueries(destination);
  for (const query of queries) {
    try {
      const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&limit=5&language=vi,en&types=region,place,locality,district` +
        (countryBias ? `&country=${countryBias}` : '');
      const geoResp = await fetch(geoUrl);
      if (!geoResp.ok) continue;

      const geoData = await geoResp.json();
      const feature = pickBestDestinationFeature(geoData.features, destination);
      if (feature?.center?.length >= 2) {
        return { lat: feature.center[1], lng: feature.center[0] };
      }
    } catch {
      // continue with next query variant
    }
  }

  return null;
}

function isVietnamContext(context) {
  return getCountryBiasFromDestination(context) === 'VN';
}

/**
 * Optimize Itinerary - Run algorithm pipeline
 * Cluster by proximity → TSP route optimization per day
 */
async function optimizeItinerary(args) {
  const {
    destination,
    startDate,
    endDate,
    budget,
    interests = [],
    travelStyle = 'comfort',
    travelers = 1,
    hotelLocation,
    mustSeeAttractions = [],
  } = args;

  try {
    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │  optimize_itinerary: Algorithm Pipeline Started         │');
    logger.info('  └─────────────────────────────────────────────────────────┘');

    const profile = this.currentUserProfile;
    let effectiveTravelStyle = travelStyle;
    let effectiveInterests = [...interests];
    let dailyRhythm = null;
    let dietaryRestrictions = [];
    let accessibilityNeeds = [];

    if (profile) {
      logger.info(`     User profile: ${profile.name || 'Anonymous'}`);

      // Override travelStyle from user profile when AI used the default 'comfort'
      if (travelStyle === 'comfort' && profile.travelProfile?.spendingHabits) {
        const spendingToStyle = {
          budget: 'budget',
          moderate: 'comfort',
          luxury: 'luxury',
        };
        const mapped = spendingToStyle[profile.travelProfile.spendingHabits];
        if (mapped) {
          effectiveTravelStyle = mapped;
          logger.info(`     Profile override: travelStyle ${travelStyle} → ${effectiveTravelStyle} (from spendingHabits)`);
        }
      }

      if (travelStyle === 'comfort' && profile.preferences?.travelStyle) {
        const prefStyles = Array.isArray(profile.preferences.travelStyle)
          ? profile.preferences.travelStyle
          : [profile.preferences.travelStyle];
        if (prefStyles.length > 0 && prefStyles[0] !== 'comfort') {
          effectiveTravelStyle = prefStyles[0];
          logger.info(`     Profile override: travelStyle → ${effectiveTravelStyle} (from UserPreference)`);
        }
      }

      // Merge travelerTypes → interests
      if (profile.travelProfile?.travelerTypes) {
        const typeToInterest = {
          adventurer: 'adventure',
          explorer: 'nature',
          culture_seeker: 'culture',
          foodie: 'food',
          photographer: 'photography',
          relaxation: 'relaxation',
        };
        for (const type of profile.travelProfile.travelerTypes) {
          const interest = typeToInterest[type];
          if (interest && !effectiveInterests.some(i => (i || '').toLowerCase() === interest)) {
            effectiveInterests.push(interest);
          }
        }
        if (effectiveInterests.length > interests.length) {
          logger.info(`     Profile merged interests: [${interests}] → [${effectiveInterests}]`);
        }
      }

      // Merge travelCompanions → interests (e.g., family → family-friendly)
      if (profile.travelProfile?.travelCompanions) {
        const companionInterests = {
          family: 'family',
          couple: 'romantic',
        };
        for (const comp of profile.travelProfile.travelCompanions) {
          const interest = companionInterests[comp];
          if (interest && !effectiveInterests.some(i => (i || '').toLowerCase() === interest)) {
            effectiveInterests.push(interest);
          }
        }
      }

      dailyRhythm = profile.travelProfile?.dailyRhythm || null;
      if (dailyRhythm) logger.info(`     Daily rhythm: ${dailyRhythm}`);

      dietaryRestrictions = profile.preferences?.dietaryRestrictions || [];
      if (dietaryRestrictions.length > 0) logger.info(`     Dietary restrictions: ${dietaryRestrictions.join(', ')}`);

      accessibilityNeeds = profile.preferences?.accessibilityNeeds || [];
      if (accessibilityNeeds.length > 0) logger.info(`     Accessibility needs: ${accessibilityNeeds.join(', ')}`);

    }

    logger.info(`     Destination: ${destination}`);
    logger.info(`     Dates: ${startDate} to ${endDate}`);
    logger.info(`     Style: ${effectiveTravelStyle}, Travelers: ${travelers}`);
    logger.info(`     Interests: [${effectiveInterests.join(', ')}]`);

    const numDays = (() => {
      if (!startDate || !endDate) return 1;
      const s = new Date(startDate);
      const e = new Date(endDate);
      return Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1);
    })();
    const gmLimit = Math.min(40, Math.max(15, numDays * 3));

    // Check if DB has enough fresh data to skip expensive Google Maps crawl
    let skipGoogleMapsCrawl = false;
    try {
      const freshThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
      const freshCount = await prisma.cached_places.count({
        where: {
          city: { contains: destination, mode: 'insensitive' },
          lastFetchedAt: { gte: freshThreshold },
        },
      });
      if (freshCount >= 15) {
        skipGoogleMapsCrawl = true;
        logger.info(`     [Cache] Found ${freshCount} fresh places in DB, skipping Google Maps crawl`);
      }
    } catch {
      // Proceed with crawl if check fails
    }

    // Launch all data sources in parallel — merge and deduplicate afterward
    const [dbSettled, searchSettled, gmSettled, weatherSettled, destCenterSettled] = await Promise.allSettled([
      // 1. Database query — reduced limit since we dedup + cap later
      (async () => {
        const dbPlaces = await prisma.cached_places.findMany({
          where: {
            OR: [
              { city: { contains: destination, mode: 'insensitive' } },
              { address: { contains: destination, mode: 'insensitive' } },
            ],
          },
          take: 50,
          orderBy: { rating: 'desc' },
        });
        return dbPlaces.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          address: p.address,
          city: p.city,
          latitude: p.latitude ? parseFloat(p.latitude) : null,
          longitude: p.longitude ? parseFloat(p.longitude) : null,
          rating: p.rating ? parseFloat(p.rating) : null,
          ratingCount: p.ratingCount,
          priceLevel: p.priceLevel,
          categories: p.categories || [],
          openingHours: p.openingHours,
          photos: p.photos,
          phone: p.phone,
          website: p.website,
          source: p.provider || 'database',
          sourceId: p.externalId || null,
          duration: estimateDuration(p.type),
          cost: estimateCost(p.type, travelStyle),
        }));
      })(),
      // 2. External API search — reduced limit
      this.searchPlaces({ location: destination, limit: Math.max(15, numDays * 5) }),
      // 3. Google Maps crawl — skip if DB has fresh data
      skipGoogleMapsCrawl
        ? Promise.resolve(null)
        : googleMapsProvider.searchPlaces(destination, { limit: gmLimit }),
      // 4. Weather (if applicable)
      startDate && this.getWeather
        ? this.getWeather({ location: destination, date: startDate })
        : Promise.resolve(null),
      // 5. Destination center geocoding (reused throughout pipeline)
      this.mapboxToken
        ? geocodeDestinationCenter(destination, this.mapboxToken)
        : Promise.resolve(null),
    ]);

    // Extract parallel results
    let places = [];
    if (dbSettled.status === 'fulfilled' && dbSettled.value) {
      places = dbSettled.value;
    } else if (dbSettled.status === 'rejected') {
      logger.error('Error fetching places from DB:', { error: dbSettled.reason?.message });
    }
    logger.info(`     Found ${places.length} places in database`);

    if (searchSettled.status === 'fulfilled' && searchSettled.value?.places) {
      const externalPlaces = searchSettled.value.places.map(p => ({
        ...p,
        source: searchSettled.value.source || 'external',
        duration: estimateDuration(p.type),
        cost: estimateCost(p.type, travelStyle),
      }));
      places = [...places, ...externalPlaces];
      logger.info(`     After external search: ${places.length} places total`);
    } else if (searchSettled.status === 'rejected') {
      logger.warn('External search failed:', { error: searchSettled.reason?.message });
    }

    // Cached destination center — reused for GM filter, geocoding, and enrichment
    let cachedDestCenter = destCenterSettled.status === 'fulfilled' ? destCenterSettled.value : null;
    if (cachedDestCenter) {
      logger.info(`     [Geocode] Destination center: ${cachedDestCenter.lat}, ${cachedDestCenter.lng}`);
    }
    this.cachedDestinationCenter = cachedDestCenter;

    // Merge Google Maps results (already fetched in parallel)
    let googleMapsRawData = [];
    try {
      const gmData = gmSettled.status === 'fulfilled' ? gmSettled.value : null;
      if (gmSettled.status === 'rejected') {
        logger.warn('[GoogleMaps] Crawl failed (non-blocking):', { error: gmSettled.reason?.message });
      }

      if (gmData?.places?.length > 0) {
        let upgraded = 0;
        let added = 0;

        // Pre-filter places outside destination radius to avoid cross-city contamination
        let gmPlaces = gmData.places;
        const existingWithCoords = places.filter(p => p.latitude && p.longitude);
        let destCenter = null;

        if (existingWithCoords.length >= 2) {
          const eLats = existingWithCoords.map(p => p.latitude).sort((a, b) => a - b);
          const eLngs = existingWithCoords.map(p => p.longitude).sort((a, b) => a - b);
          destCenter = {
            lat: eLats[Math.floor(eLats.length / 2)],
            lng: eLngs[Math.floor(eLngs.length / 2)],
          };
        } else {
          destCenter = cachedDestCenter;
        }

        if (destCenter) {
          const GM_RADIUS_KM = 50;
          const beforeGmCount = gmPlaces.length;
          gmPlaces = gmPlaces.filter(p => {
            if (!p.latitude || !p.longitude) return true; // geocoded + filtered later
            const dist = haversineDistance(destCenter, { lat: p.latitude, lng: p.longitude });
            return dist <= GM_RADIUS_KM;
          });
          const gmFiltered = beforeGmCount - gmPlaces.length;
          if (gmFiltered > 0) {
            logger.info(`     [GoogleMaps] Pre-filtered ${gmFiltered} places outside ${GM_RADIUS_KM}km radius`);
          }
        }

        googleMapsRawData = gmPlaces.map(p => ({
          name: p.name,
          rating: p.rating,
          ratingCount: p.ratingCount,
          address: p.address,
          type: p.type,
          openingHours: p.openingHours,
          phone: p.phone,
          website: p.website,
          googleMapsUrl: p.website, // Google Maps URL for detail crawling
          photoUrl: p.photoUrl || null,
          reviewSnippet: p.reviewSnippet || null,
          description: p.description || null,
          priceLevel: p.priceLevel || null,
          rawText: p.rawText || null,
        }));

        for (const gmPlace of gmPlaces) {
          // Strict name matching to avoid false positives across city boundaries.
          // Shorter name must be >= 70% the length of the longer one to qualify.
          const gmNameLower = gmPlace.name?.toLowerCase();
          const existing = gmNameLower && places.find(p => {
            if (!p.name) return false;
            const pNameLower = p.name.toLowerCase();
            if (pNameLower === gmNameLower) return true;
            const shorter = Math.min(pNameLower.length, gmNameLower.length);
            const longer = Math.max(pNameLower.length, gmNameLower.length);
            if (shorter < 4 || shorter / longer < 0.7) return false;
            return pNameLower.includes(gmNameLower) || gmNameLower.includes(pNameLower);
          });

          if (existing) {
            if (gmPlace.rating != null && existing.rating == null) existing.rating = gmPlace.rating;
            if (gmPlace.ratingCount != null && existing.ratingCount == null) existing.ratingCount = gmPlace.ratingCount;
            if (gmPlace.openingHours && !existing.openingHours) existing.openingHours = gmPlace.openingHours;
            if (gmPlace.phone && !existing.phone) existing.phone = gmPlace.phone;
            if (gmPlace.website && !existing.website) existing.website = gmPlace.website;
            upgraded++;
          } else {
            places.push({
              name: gmPlace.name,
              type: gmPlace.type || 'ATTRACTION',
              address: gmPlace.address,
              latitude: gmPlace.latitude,
              longitude: gmPlace.longitude,
              rating: gmPlace.rating,
              ratingCount: gmPlace.ratingCount,
              openingHours: gmPlace.openingHours,
              phone: gmPlace.phone,
              website: gmPlace.website,
              source: 'google_maps',
              duration: estimateDuration(gmPlace.type),
              cost: estimateCost(gmPlace.type, travelStyle),
            });
            added++;
          }
        }

        logger.info(`     [GoogleMaps] Merged: ${added} new places, ${upgraded} upgraded existing`);
        logger.info(`     After Google Maps: ${places.length} places total`);

        // Detail crawl for top places
        try {
          const topPlaces = gmPlaces
            .filter(p => p.website?.includes('/maps/place/'))
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5);

          if (topPlaces.length > 0) {
            logger.info(`     [GoogleMaps] Starting detail crawl for ${topPlaces.length} top places...`);
            const detailMap = await googleMapsProvider.getPlaceDetails(topPlaces);

            for (const rawEntry of googleMapsRawData) {
              const detail = detailMap.get(rawEntry.name);
              if (detail) rawEntry.enrichedDetail = detail;
            }

            googleMapsProvider._saveEnrichedToDB(detailMap, destination).catch(() => { }); // background
          }
        } catch (detailError) {
          logger.warn('[GoogleMaps] Detail crawl failed (non-blocking):', detailError.message);
        }
      }
    } catch (gmError) {
      logger.warn('[GoogleMaps] Processing failed (non-blocking):', { error: gmError.message });
    }

    // Geocode places missing coordinates; reject results too far from destination
    if (this.mapboxToken) {
      const noCoordPlaces = places.filter(p => !p.latitude || !p.longitude);
      if (noCoordPlaces.length > 0) {
        logger.info(`     [Geocode] ${noCoordPlaces.length} places missing coordinates, geocoding...`);
        let geocodeCenter = null;
        const placesWithCoords = places.filter(p => p.latitude && p.longitude);
        if (placesWithCoords.length >= 2) {
          const sortedLats = placesWithCoords.map(p => p.latitude).sort((a, b) => a - b);
          const sortedLngs = placesWithCoords.map(p => p.longitude).sort((a, b) => a - b);
          geocodeCenter = {
            lat: sortedLats[Math.floor(sortedLats.length / 2)],
            lng: sortedLngs[Math.floor(sortedLngs.length / 2)],
          };
        } else {
          geocodeCenter = cachedDestCenter; // Reuse cached result instead of re-geocoding
        }

        let geocoded = 0;
        let rejected = 0;
        const GEOCODE_RADIUS_KM = 50;
        const batchSize = 5;
        for (let i = 0; i < noCoordPlaces.length; i += batchSize) {
          const batch = noCoordPlaces.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (p) => {
              try {
                const countryBias = getCountryBiasFromDestination(destination);
                const countryHint = countryBias === 'VN' ? ', Vietnam' : '';
                const query = `${p.name}, ${destination}${countryHint}`;
                let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                  `access_token=${this.mapboxToken}&limit=1&language=vi,en&types=poi,address` +
                  (countryBias ? `&country=${countryBias}` : '');
                if (geocodeCenter) url += `&proximity=${geocodeCenter.lng},${geocodeCenter.lat}`;
                const resp = await fetch(url);
                if (!resp.ok) return null;
                const data = await resp.json();
                const feature = data.features?.[0];
                if (feature) {
                  const coords = { lat: feature.center[1], lng: feature.center[0] };
                  if (geocodeCenter && haversineDistance(geocodeCenter, coords) > GEOCODE_RADIUS_KM) {
                    return 'rejected';
                  }
                  return coords;
                }
              } catch { /* skip */ }
              return null;
            })
          );
          batch.forEach((p, idx) => {
            if (results[idx] === 'rejected') {
              rejected++;
            } else if (results[idx]) {
              p.latitude = results[idx].lat;
              p.longitude = results[idx].lng;
              geocoded++;
            }
          });
          if (i + batchSize < noCoordPlaces.length) {
            await new Promise(r => setTimeout(r, 50));
          }
        }
        logger.info(`     [Geocode] Geocoded ${geocoded}/${noCoordPlaces.length} places` +
          (rejected > 0 ? ` (${rejected} rejected — too far from ${destination})` : ''));
      }
    }

    // Radius filter: drop places outside the destination area (median-based center)
    const placesBeforeFilter = [...places];
    logger.info(`[optimize] Before radius filter: ${places.length} places`);
    const placesWithCoords = places.filter(p => p.latitude && p.longitude);
    if (placesWithCoords.length >= 3) {
      const lats = placesWithCoords.map(p => p.latitude).sort((a, b) => a - b);
      const lngs = placesWithCoords.map(p => p.longitude).sort((a, b) => a - b);
      const center = { lat: lats[Math.floor(lats.length / 2)], lng: lngs[Math.floor(lngs.length / 2)] };
      const getSearchRadius = (placeCount) => {
        if (placeCount < 10) return 150;
        if (placeCount < 20) return 100;
        return 50;
      };
      const MAX_RADIUS_KM = getSearchRadius(placesWithCoords.length);
      const beforeCount = places.length;
      places = places.filter(p => {
        if (!p.latitude || !p.longitude) return true;
        return haversineDistance(center, { lat: p.latitude, lng: p.longitude }) <= MAX_RADIUS_KM;
      });
      const filtered = beforeCount - places.length;
      if (filtered > 0) {
        logger.info(`     Filtered out ${filtered} places outside ${MAX_RADIUS_KM}km radius`);
      }
    }
    logger.info(`[optimize] After radius filter: ${places.length} places`);

    // Deduplicate across sources (DB, Mapbox, Google Maps)
    const beforeDedup = places.length;
    places = deduplicatePlaces(places);
    if (beforeDedup !== places.length) {
      logger.info(`     [Dedup] Removed ${beforeDedup - places.length} duplicates: ${beforeDedup} → ${places.length}`);
    }

    // Filter out low-quality places (street names, district names, etc.)
    logger.info(`[optimize] Before quality filter: ${places.length} places`);
    const beforeQuality = places.length;
    places = filterLowQualityPlaces(places);
    logger.info(`[optimize] After quality filter: ${places.length} places`);
    if (beforeQuality !== places.length) {
      logger.info(`     [Quality] Removed ${beforeQuality - places.length} low-quality places: ${beforeQuality} → ${places.length}`);
    }

    // Cap total places to avoid excessive token usage in AI response
    const MAX_TOTAL_PLACES = Math.min(60, Math.max(30, numDays * 8));
    if (places.length > MAX_TOTAL_PLACES) {
      // Prioritize: places with ratings > places with coordinates > rest
      places.sort((a, b) => {
        const scoreA = (a.rating ? 10 : 0) + (a.ratingCount ? 5 : 0) + (a.latitude ? 3 : 0) + (a.source === 'google_maps' ? 2 : 0);
        const scoreB = (b.rating ? 10 : 0) + (b.ratingCount ? 5 : 0) + (b.latitude ? 3 : 0) + (b.source === 'google_maps' ? 2 : 0);
        return scoreB - scoreA;
      });
      places = places.slice(0, MAX_TOTAL_PLACES);
      logger.info(`     [Cap] Limited to ${MAX_TOTAL_PLACES} places (prioritized by quality)`);
    }

    if (places.length === 0 && placesBeforeFilter.length > 0) {
      logger.warn(`[optimize] All ${placesBeforeFilter.length} places filtered out — using unfiltered set`);
      places = placesBeforeFilter;
    }

    if (places.length === 0) {
      return {
        success: false,
        error: `No places found for destination "${destination}". Try using web_search or search_places first.`,
      };
    }

    // Weather was fetched in parallel — extract result
    let weatherData = weatherSettled.status === 'fulfilled' ? weatherSettled.value : null;
    if (weatherSettled.status === 'rejected') {
      logger.warn('     Weather fetch failed (optional):', { error: weatherSettled.reason?.message });
    }
    if (weatherData) {
      logger.info(`     Weather: ${weatherData.condition || 'fetched'}`);
    }

    const planner = new TripPlanner();
    const itinerary = await planner.generateItinerary(
      {
        destination,
        startDate,
        endDate,
        budget,
        interests: effectiveInterests,
        travelStyle: effectiveTravelStyle,
        travelers,
        hotelLocation,
        mustSeeAttractions,
        dailyRhythm,
        dietaryRestrictions,
        accessibilityNeeds,
      },
      places
    );

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │  optimize_itinerary: Pipeline Complete                  │');
    logger.info('  └─────────────────────────────────────────────────────────┘');
    logger.info(`     Days: ${itinerary.days?.length}, Places: ${itinerary.summary?.totalPlaces}`);

    let weatherSummary = null;
    if (weatherData) {
      weatherSummary = {
        condition: weatherData.condition,
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        forecast: weatherData.forecast,
      };
    }

    const sourceMap = new Map();
    for (const p of places) {
      const src = p.source || 'unknown';
      if (!sourceMap.has(src)) {
        sourceMap.set(src, { provider: src, count: 0, places: [] });
      }
      const entry = sourceMap.get(src);
      entry.count++;
      if (entry.places.length < 5) {
        entry.places.push(p.name);
      }
    }

    // Trim itinerary for AI: strip long URLs, photos, rawText to reduce token usage
    const trimmedItinerary = {
      ...itinerary,
      days: itinerary.days.map(day => ({
        ...day,
        places: day.places.map(trimPlaceForAI),
      })),
    };

    return {
      success: true,
      itinerary: trimmedItinerary,
      placesUsed: places.length,
      algorithm: itinerary.metadata?.algorithm,
      weather: weatherSummary,
      sources: Array.from(sourceMap.values()).map(s => ({ provider: s.provider, count: s.count })),
      // Trimmed Google Maps enrichment data (no rawText, no long URLs)
      googleMapsData: trimGoogleMapsDataForAI(googleMapsRawData),
    };
  } catch (error) {
    logger.error('optimize_itinerary failed:', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

const PLACEHOLDER_THEMES = [
  {
    theme: 'Wellness & Relaxation Day',
    activities: [
      { time: '08:00', title: 'Morning Yoga & Meditation', type: 'activity', duration: 60, estimatedCost: 0, description: 'Start the day with a calming yoga session to recharge body and mind.' },
      { time: '10:00', title: 'Traditional Spa & Massage', type: 'activity', duration: 120, estimatedCost: 500000, description: 'Treat yourself to a local therapeutic massage session.' },
      { time: '14:00', title: 'Pool & Resort Relaxation', type: 'activity', duration: 180, estimatedCost: 0, description: 'Enjoy leisure time at the resort pool or a quiet garden.' },
      { time: '18:00', title: 'Sunset Walk', type: 'activity', duration: 60, estimatedCost: 0, description: 'A peaceful evening stroll to watch the sunset.' },
    ],
  },
  {
    theme: 'Local Market & Culinary Discovery',
    activities: [
      { time: '08:00', title: 'Morning Local Market Visit', type: 'activity', duration: 90, estimatedCost: 100000, description: 'Explore the vibrant local market and sample street food.' },
      { time: '11:00', title: 'Local Cooking Class', type: 'activity', duration: 180, estimatedCost: 400000, description: 'Learn to cook authentic local dishes in a hands-on class.' },
      { time: '16:00', title: 'Café & Free Time', type: 'activity', duration: 120, estimatedCost: 100000, description: 'Relax at a local café and explore the neighbourhood.' },
    ],
  },
  {
    theme: 'Cultural Immersion Day',
    activities: [
      { time: '09:00', title: 'Temple or Heritage Site Visit', type: 'attraction', duration: 120, estimatedCost: 150000, description: 'Explore a nearby temple or cultural heritage site.' },
      { time: '13:00', title: 'Traditional Arts Workshop', type: 'activity', duration: 120, estimatedCost: 300000, description: 'Try a local craft: batik painting, silverwork, or a dance class.' },
      { time: '17:00', title: 'Local Neighbourhood Walk', type: 'activity', duration: 90, estimatedCost: 0, description: 'Wander through local streets and soak in everyday life.' },
    ],
  },
  {
    theme: 'Nature & Scenic Exploration',
    activities: [
      { time: '07:00', title: 'Sunrise Viewpoint', type: 'attraction', duration: 90, estimatedCost: 50000, description: 'Rise early to catch a breathtaking sunrise from a scenic spot.' },
      { time: '10:00', title: 'Nature Walk or Hiking Trail', type: 'activity', duration: 180, estimatedCost: 100000, description: 'Explore a nature trail, rice terrace, or local park at a relaxed pace.' },
      { time: '15:00', title: 'Waterfall or River Visit', type: 'attraction', duration: 120, estimatedCost: 50000, description: 'Visit a nearby natural landmark for swimming or photography.' },
    ],
  },
  {
    theme: 'Free Day — Rest & Personal Exploration',
    activities: [
      { time: '10:00', title: 'Leisurely Morning', type: 'activity', duration: 120, estimatedCost: 0, description: 'Sleep in and enjoy a slow breakfast. No fixed plans — follow your mood.' },
      { time: '13:00', title: 'Shopping & Souvenir Hunt', type: 'shopping', duration: 120, estimatedCost: 500000, description: 'Browse local shops and pick up souvenirs or handicrafts.' },
      { time: '16:00', title: 'Café & Journaling', type: 'activity', duration: 90, estimatedCost: 100000, description: 'Find a cosy café, reflect on the trip, and enjoy the local atmosphere.' },
    ],
  },
];

/**
 * Fill missing days when AI output is truncated due to token limits.
 * Matches AI-provided days by date or dayNumber; remaining dates get
 * rotating placeholder days so the draft always covers the full trip.
 */
function completeTripDays(aiDays, startDate, endDate, destination) {
  if (!startDate || !endDate) return aiDays;

  const byDate = new Map();
  const byNumber = new Map();
  for (const day of aiDays) {
    if (day.date) byDate.set(day.date, day);
    if (day.dayNumber != null) byNumber.set(day.dayNumber, day);
  }

  const allDates = [];
  for (
    let d = new Date(startDate + 'T00:00:00');
    d <= new Date(endDate + 'T00:00:00');
    d.setDate(d.getDate() + 1)
  ) {
    allDates.push(d.toISOString().split('T')[0]);
  }

  const totalDays = allDates.length;
  if (aiDays.length >= totalDays) return aiDays; // Nothing to fill

  const completedDays = [];
  let autoGenCount = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = allDates[i];
    const dayNumber = i + 1;

    const existing = byDate.get(date) || byNumber.get(dayNumber);
    if (existing) {
      completedDays.push({ ...existing, dayNumber, date });
      continue;
    }

    const tpl = PLACEHOLDER_THEMES[autoGenCount % PLACEHOLDER_THEMES.length];
    autoGenCount++;

    completedDays.push({
      dayNumber,
      date,
      theme: tpl.theme,
      activities: tpl.activities.map((act, idx) => ({
        ...act,
        orderIndex: idx,
        location: destination,
        transportFromPrevious: idx > 0
          ? { mode: 'TAXI', distance: 5, duration: 15, cost: 100000, instructions: 'Take a local taxi or ride-hailing app.' }
          : null,
      })),
      meals: {
        breakfast: 'At the hotel/resort',
        lunch: 'Local restaurant near the day\'s activities',
        dinner: 'Explore a restaurant recommended in the area',
      },
      _autoGenerated: true,
    });
  }

  if (autoGenCount > 0) {
    logger.info(`  [completeTripDays] Auto-generated ${autoGenCount} placeholder days (AI provided ${aiDays.length}/${totalDays})`);
  }

  return completedDays;
}

/**
 * Create Trip Plan - Signal to create and save trip plan
 *
 * FLOW: Step 5 - Draft Storage (via Tool)
 */
async function createTripPlan(args) {
  let {
    title,
    destination,
    description,
    startDate,
    endDate,
    travelersCount = 1,
    itineraryData,
    overview,
    travelTips,
    budgetBreakdown,
    bookingSuggestions,
  } = args;

  // Generate default dates when not provided
  if (!startDate && itineraryData?.days?.length > 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = itineraryData.startDate
      || tomorrow.toISOString().split('T')[0];
    const numDays = itineraryData.days.length;
    const end = new Date(startDate);
    end.setDate(end.getDate() + numDays - 1);
    endDate = itineraryData.endDate
      || end.toISOString().split('T')[0];
  }

  const resolvedDestination = destination
    || itineraryData?.destination
    || itineraryData?.trip?.destination
    || inferDestinationFromDays(itineraryData?.days)
    || inferDestinationFromText(description);
  const resolvedTitle = title || (resolvedDestination ? `Trip to ${resolvedDestination}` : null);

  try {
    console.log('\n  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  STEP 5: DRAFT STORAGE (via create_trip_plan tool)      │');
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log(`  AI requested trip plan creation:`);
    console.log(`     - Title: ${resolvedTitle}`);
    console.log(`     - Destination: ${resolvedDestination}`);
    console.log(`     - Dates: ${startDate || 'N/A'} to ${endDate || 'N/A'}`);
    console.log(`     - Travelers: ${travelersCount}`);

    if (!resolvedDestination) {
      logger.warn('  Validation failed: Destination is required');
      throw new Error('Destination is required');
    }

    if (itineraryData && itineraryData.days) {
      logger.info(`  Itinerary has ${itineraryData.days.length} days (AI-provided)`);
      const enrichedDays = await enrichItinerary.call(this, itineraryData.days, resolvedDestination);

      // Calculate endDate if not provided
      let calculatedEndDate = endDate;
      if (!calculatedEndDate && startDate && itineraryData.days.length > 0) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + itineraryData.days.length - 1);
        calculatedEndDate = end.toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      const completedDays = completeTripDays(
        enrichedDays,
        startDate,
        endDate || calculatedEndDate,
        resolvedDestination
      );
      logger.info(`  Total days in draft: ${completedDays.length} (${enrichedDays.length} from AI + ${completedDays.length - enrichedDays.length} auto-generated)`);

      // Handle budget - AI might send totalEstimatedCost or budget
      const budgetValue = itineraryData.totalEstimatedCost || itineraryData.budget || null;
      const currencyValue = itineraryData.currency || 'VND';

      // ═══════════════════════════════════════════════════════════════
      // Phase 1: Prepare comprehensive draft data
      // ═══════════════════════════════════════════════════════════════
      const draftData = {
        trip: {
          destination: resolvedDestination,
          title: resolvedTitle,
          description: description || `Trip to ${resolvedDestination}`,
          startDate: startDate || null,
          endDate: calculatedEndDate,
          travelers: travelersCount,
        },
        days: completedDays,
        budget: typeof budgetValue === 'object' ? budgetValue : { total: budgetValue, currency: currencyValue },
        tips: itineraryData.tips || [],
        overview: overview || null,
        travelTips: travelTips || null,
        budgetBreakdown: budgetBreakdown || null,
        bookingSuggestions: bookingSuggestions || null,
      };

      logger.info('  Phase 1 data included:');
      if (overview) logger.info('    ✓ Overview (summary, highlights, weather)');
      if (travelTips) logger.info('    ✓ Travel tips (general, transport, food, safety, budget)');
      if (budgetBreakdown) logger.info('    ✓ Budget breakdown (accommodation, food, transport, activities)');
      if (bookingSuggestions) logger.info(`    ✓ Booking suggestions (${bookingSuggestions.length} items)`);

      logger.info('  Saving draft to database...');
      const draft = await aiDraftRepository.createDraft(
        this.currentConversationId || null,
        JSON.stringify({ title: resolvedTitle, destination: resolvedDestination, startDate, endDate }),
        draftData
      );

      logger.info(`  Draft created with ID: ${draft.id}`);

      const geocodedCount = completedDays.reduce((count, day) => {
        return count + (day.activities?.filter(a => a.coordinates)?.length || 0);
      }, 0);
      const imageCount = completedDays.reduce((count, day) => {
        return count + (day.activities?.filter(a => a.image)?.length || 0);
      }, 0);

      if (this.currentUserId) {
        try {

          const applyResult = await applyAIDraftUseCase.execute({
            draftId: draft.id,
            userId: this.currentUserId,
            createNew: true,
          });

          logger.info(`  Trip created from draft: ${applyResult.trip.id}`);

          return {
            success: true,
            action: 'trip_created',
            draftId: draft.id,
            tripId: applyResult.trip.id,
            trip: {
              id: applyResult.trip.id,
              title: applyResult.trip.title,
              destination: applyResult.trip.destination,
              startDate: applyResult.trip.start_date,
              endDate: applyResult.trip.end_date,
              daysCount: applyResult.trip.itinerary_days?.length || 0,
            },
            geocodedPlaces: geocodedCount,
            activitiesWithImages: imageCount,
          };
        } catch (applyError) {
          logger.error('  Auto-apply failed:', { error: applyError.message });
        }
      }

      logger.info('  └─────────────────────────────────────────────────────────┘');
      return {
        success: true,
        action: 'draft_created',
        draftId: draft.id,
        title: resolvedTitle,
        destination: resolvedDestination,
        geocodedPlaces: geocodedCount,
        activitiesWithImages: imageCount,
      };
    } else {
      return {
        success: true,
        action: 'signal_intent',
        title: resolvedTitle,
        destination: resolvedDestination,
        startDate,
        endDate,
        travelersCount,
        requiresItineraryData: true,
      };
    }
  } catch (error) {
    console.error('Failed to create trip plan:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

function inferDestinationFromDays(days) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const counts = new Map();

  for (const day of days) {
    for (const activity of day.activities || []) {
      if (!activity?.location || typeof activity.location !== 'string') continue;
      const parts = activity.location.split(',').map(p => p.trim()).filter(Boolean);
      const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      const country = parts.length >= 1 ? parts[parts.length - 1] : null;
      if (!city) continue;
      const key = country ? `${city}, ${country}` : city;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  let best = null;
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function inferDestinationFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(?:du lịch|đến|tại)\s+([^,.]+(?:,\s*[^,.]+)?)/i);
  if (!match?.[1]) return null;

  let candidate = match[1].trim();
  candidate = candidate.replace(/\b\d+\s*(ngày|đêm)\b.*$/i, '').trim();
  candidate = candidate.replace(/\b(dành cho|cho)\b.*$/i, '').trim();
  candidate = candidate.replace(/[;:!?]+$/, '').trim();

  if (!candidate || candidate.length > 80) return null;
  return candidate;
}

/**
 * Enrich itinerary with both coordinates and images (in parallel)
 */
async function enrichItinerary(days, destination) {
  // Run coordinate geocoding and image collection concurrently
  const [coordEnrichedDays, imageMap] = await Promise.all([
    enrichItineraryWithCoordinates.call(this, days, destination),
    collectActivityImages(days, destination),
  ]);
  // Merge images into coordinate-enriched days
  return mergeImagesIntoDays(coordEnrichedDays, imageMap);
}

/**
 * Collect images for all activities without modifying day structure.
 * Returns a Map keyed by "dayIndex_activityIndex" → image data.
 */
async function collectActivityImages(days, destination) {
  console.log('[Images] Collecting activity images...');
  const imageMap = new Map();
  const promises = [];

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    if (!day.activities) continue;
    for (let ai = 0; ai < day.activities.length; ai++) {
      const activity = day.activities[ai];
      const key = `${di}_${ai}`;

      if (activity.googleMapsInfo?.photos?.length > 0) {
        imageMap.set(key, {
          image: activity.googleMapsInfo.photos[0],
          thumbnail: activity.googleMapsInfo.photos[0],
          photos: activity.googleMapsInfo.photos,
          sourceProvider: 'GOOGLE_MAPS',
        });
      } else {
        promises.push(
          getActivityImages(activity, destination).then(images => {
            const provider = images.image?.includes('pexels.com') ? 'PEXELS'
              : images.image?.includes('picsum.photos') ? 'PICSUM'
                : 'PEXELS';
            imageMap.set(key, { image: images.image, thumbnail: images.thumbnail, sourceProvider: provider });
          })
        );
      }
    }
  }

  await Promise.all(promises);
  const imageCount = imageMap.size;
  console.log(`[Images] Collected images for ${imageCount} activities`);
  return imageMap;
}

/**
 * Merge pre-collected image data into coordinate-enriched days.
 */
function mergeImagesIntoDays(days, imageMap) {
  return days.map((day, di) => {
    if (!day.activities) return day;
    return {
      ...day,
      activities: day.activities.map((activity, ai) => {
        const images = imageMap.get(`${di}_${ai}`);
        if (!images) return activity;
        return { ...activity, ...images };
      }),
    };
  });
}

/**
 * Enrich itinerary activities with coordinates from Mapbox
 */
async function enrichItineraryWithCoordinates(days, destination) {
  if (!this.mapboxToken) {
    console.warn('MAPBOX_ACCESS_TOKEN not configured, skipping geocoding');
    return days;
  }

  console.log('[Mapbox] Enriching itinerary with coordinates...');
  const destinationCenter = this.cachedDestinationCenter || await geocodeDestinationCenter(destination, this.mapboxToken);
  const MAX_ACTIVITY_DISTANCE_KM = 80;

  const locationMap = new Map();
  for (const day of days) {
    if (!day.activities) continue;
    for (const activity of day.activities) {
      if (activity.location && !locationMap.has(activity.location)) {
        locationMap.set(activity.location, null);
      }
    }
  }

  console.log(`Found ${locationMap.size} unique locations to geocode`);

  const locations = Array.from(locationMap.keys());
  const batchSize = 5;

  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(loc => geocodeLocationForItinerary.call(this, loc, destination, destinationCenter))
    );

    batch.forEach((loc, idx) => {
      locationMap.set(loc, results[idx]);
    });

    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const enrichedDays = days.map(day => {
    if (!day.activities) return day;

    const enrichedActivities = day.activities.map(activity => {
      const coords = locationMap.get(activity.location);
      if (coords) {
        return {
          ...activity,
          coordinates: coords,
        };
      }

      // Drop AI-provided coordinates that are far from destination center.
      const existing = activity.coordinates;
      if (
        destinationCenter &&
        existing &&
        typeof existing.lat === 'number' &&
        typeof existing.lng === 'number'
      ) {
        const dist = haversineDistance(destinationCenter, { lat: existing.lat, lng: existing.lng });
        if (dist > MAX_ACTIVITY_DISTANCE_KM) {
          const { coordinates: _coordinates, ...rest } = activity;
          return rest;
        }
      }

      return activity;
    });

    return {
      ...day,
      activities: enrichedActivities,
    };
  });

  const geocodedCount = Array.from(locationMap.values()).filter(v => v !== null).length;
  console.log(`Geocoded ${geocodedCount}/${locationMap.size} locations`);

  return enrichedDays;
}

/**
 * Geocode a single location using Mapbox
 */
async function geocodeLocationForItinerary(location, context, destinationCenter = null) {
  try {
    const cleanLocation = location
      .replace(/TP\.HCM|TP HCM|TPHCM/gi, 'Thành phố Hồ Chí Minh')
      .replace(/HCM/gi, 'Hồ Chí Minh');

    const countryBias = getCountryBiasFromDestination(context);

    let searchQuery = cleanLocation;
    if (context && !cleanLocation.toLowerCase().includes((context || '').toLowerCase().split(',')[0])) {
      searchQuery = `${cleanLocation}, ${context}`;
    }
    if (countryBias === 'VN' && !searchQuery.toLowerCase().includes('việt nam') && !searchQuery.toLowerCase().includes('vietnam')) {
      searchQuery = `${searchQuery}, Vietnam`;
    }

    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
      `access_token=${this.mapboxToken}&limit=5&language=vi,en&types=poi,address,place,locality`;
    if (isVietnamContext(context)) url += '&country=VN';

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const feature = findBestGeocodingResult(data.features, location, context);

    if (feature) {
      const candidate = {
        lat: feature.center[1],
        lng: feature.center[0],
        placeName: feature.place_name,
        placeType: feature.place_type?.[0] || 'unknown',
      };

      if (destinationCenter) {
        const distance = haversineDistance(destinationCenter, { lat: candidate.lat, lng: candidate.lng });
        if (distance > 80) return null;
      }

      return candidate;
    }
  } catch (error) {
    console.debug(`Failed to geocode "${location}":`, error.message);
  }

  return null;
}

/**
 * Find the best geocoding result from multiple candidates
 */
function findBestGeocodingResult(features, originalLocation, context) {
  if (!features || features.length === 0) return null;
  if (features.length === 1) return features[0];

  const locationLower = (originalLocation || '').toLowerCase();
  const contextLower = context?.toLowerCase() || '';

  const scored = features.map(f => {
    let score = 0;
    const placeName = f.place_name?.toLowerCase() || '';
    const placeType = f.place_type?.[0];

    locationLower.split(/[,\s]+/).filter(p => p.length > 2).forEach(part => {
      if (placeName.includes(part)) score += 10;
    });
    if (contextLower && placeName.includes(contextLower.split(',')[0])) score += 5;

    if (placeType === 'poi') score += 8;
    else if (placeType === 'address') score += 6;
    else if (placeType === 'neighborhood') score += 4;
    else if (placeType === 'locality') score += 2;
    else if (placeType === 'place' || placeType === 'region' || placeType === 'country') score -= 5;

    return { feature: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0].feature;
}

/**
 * Enrich itinerary activities with images
 * Uses Pexels API if available, falls back to Lorem Picsum
 */
async function enrichItineraryWithImages(days, destination) {
  console.log('[Images] Enriching itinerary with images...');

  const enrichedDays = await Promise.all(days.map(async (day) => {
    if (!day.activities) return day;

    const enrichedActivities = await Promise.all(day.activities.map(async (activity) => {
      if (activity.googleMapsInfo?.photos?.length > 0) {
        return {
          ...activity,
          image: activity.googleMapsInfo.photos[0],
          thumbnail: activity.googleMapsInfo.photos[0],
          photos: activity.googleMapsInfo.photos,
        };
      }

      const images = await getActivityImages(activity, destination);

      return {
        ...activity,
        image: images.image,
        thumbnail: images.thumbnail,
      };
    }));

    return {
      ...day,
      activities: enrichedActivities,
    };
  }));

  const imageCount = enrichedDays.reduce((count, day) => {
    return count + (day.activities?.filter(a => a.image)?.length || 0);
  }, 0);
  console.log(`Added images to ${imageCount} activities`);

  return enrichedDays;
}

/**
 * Get images for an activity - tries Pexels first, falls back to Lorem Picsum
 */
async function getActivityImages(activity, destination, width = 800, height = 600) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (apiKey) {
    try {
      const searchTerms = buildImageSearchTerms(activity, destination);
      const cacheKey = `${searchTerms}_${width}x${height}`;
      if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

      const pexelsImage = await fetchPexelsImage(searchTerms, width, height, apiKey);
      if (pexelsImage) {
        const result = {
          image: pexelsImage.large,
          thumbnail: pexelsImage.medium,
        };
        imageCache.set(cacheKey, result);
        return result;
      }
      console.warn(`[Pexels] No results for: "${searchTerms}"`);
    } catch (error) {
      console.warn('[Pexels] API failed, falling back to placeholder:', error.message);
    }
  } else {
    console.warn('[Pexels] PEXELS_API_KEY not set — using placeholder images');
  }

  // Fallback to Lorem Picsum
  const seed = hashCode(`${activity.title || ''}${activity.location || ''}${destination || ''}`);
  return {
    image: `https://picsum.photos/seed/${seed}/${width}/${height}`,
    thumbnail: `https://picsum.photos/seed/${seed}/400/300`,
  };
}

/**
 * Fetch image from Pexels API
 */
async function fetchPexelsImage(query, _width, _height, apiKey) {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey || process.env.PEXELS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[0];
      return {
        large: photo.src.large2x || photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small,
        original: photo.src.original,
      };
    }

    return null;
  } catch (error) {
    console.error('Pexels fetch error:', error.message);
    return null;
  }
}

/**
 * Simple hash function to generate deterministic seed from string
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Build search terms for image lookup based on activity
 */
function buildImageSearchTerms(activity, destination) {
  const terms = [];

  const typeKeywords = {
    attraction: ['landmark', 'sightseeing', 'tourist'],
    restaurant: ['food', 'restaurant', 'cuisine', 'dining'],
    hotel: ['hotel', 'accommodation', 'resort'],
    transport: ['travel', 'transportation'],
    activity: ['activity', 'adventure', 'outdoor'],
    shopping: ['shopping', 'market', 'store'],
    entertainment: ['entertainment', 'fun', 'show'],
    cafe: ['cafe', 'coffee', 'coffeeshop'],
  };

  const activityType = activity.type?.toLowerCase() || 'attraction';
  const typeTerms = typeKeywords[activityType] || ['travel'];
  terms.push(typeTerms[0]);

  if (activity.location) {
    const locationWords = activity.location
      .replace(/[,.]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 2);
    terms.push(...locationWords);
  }

  if (destination) {
    const destParts = destination.split(',')[0].trim();
    terms.push(destParts);
  }

  terms.push('travel');

  const uniqueTerms = [...new Set(terms.filter(Boolean).map(t => String(t).toLowerCase()))];
  return uniqueTerms.slice(0, 4).join(',');
}

/**
 * Generate a Mapbox Static Map image as fallback
 */
export function generateMapboxStaticImage(mapboxToken, coordinates, width = 600, height = 400) {
  if (!mapboxToken || !coordinates?.lat || !coordinates?.lng) {
    return null;
  }

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-l+f74e4e(${coordinates.lng},${coordinates.lat})/` +
    `${coordinates.lng},${coordinates.lat},14,0/` +
    `${width}x${height}@2x?access_token=${mapboxToken}`;
}
