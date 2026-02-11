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

// Pexels API key for contextual images
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Cache for Pexels images to avoid repeated API calls
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

    // ── Read user profile from executor context ──
    const profile = this.currentUserProfile;
    let effectiveTravelStyle = travelStyle;
    let effectiveInterests = [...interests];
    let dailyRhythm = null;
    let dietaryRestrictions = [];

    if (profile) {
      logger.info(`     User profile: ${profile.name || 'Anonymous'}`);

      // Map spendingHabits → travelStyle (only if AI used default 'comfort')
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

      // Also check UserPreference.travelStyle
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
          if (interest && !effectiveInterests.some(i => i.toLowerCase() === interest)) {
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
          if (interest && !effectiveInterests.some(i => i.toLowerCase() === interest)) {
            effectiveInterests.push(interest);
          }
        }
      }

      // Extract daily rhythm for schedule timing
      dailyRhythm = profile.travelProfile?.dailyRhythm || null;
      if (dailyRhythm) {
        logger.info(`     Daily rhythm: ${dailyRhythm}`);
      }

      // Extract dietary restrictions for context
      dietaryRestrictions = profile.preferences?.dietaryRestrictions || [];
      if (dietaryRestrictions.length > 0) {
        logger.info(`     Dietary restrictions: ${dietaryRestrictions.join(', ')}`);
      }
    }

    logger.info(`     Destination: ${destination}`);
    logger.info(`     Dates: ${startDate} to ${endDate}`);
    logger.info(`     Style: ${effectiveTravelStyle}, Travelers: ${travelers}`);
    logger.info(`     Interests: [${effectiveInterests.join(', ')}]`);

    // Step 1: Fetch places from cached_places table
    let places = [];
    try {
      const dbPlaces = await prisma.cached_places.findMany({
        where: {
          OR: [
            { city: { contains: destination, mode: 'insensitive' } },
            { address: { contains: destination, mode: 'insensitive' } },
          ],
        },
        take: 100,
        orderBy: { rating: 'desc' },
      });

      places = dbPlaces.map(p => ({
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
    } catch (dbError) {
      logger.error('Error fetching places from DB:', { error: dbError.message });
    }

    logger.info(`     Found ${places.length} places in database`);

    // Calculate trip duration for dynamic thresholds
    const numDays = (() => {
      if (!startDate || !endDate) return 1;
      const s = new Date(startDate);
      const e = new Date(endDate);
      return Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1);
    })();

    // Step 2: If not enough places, use search_places tool to get more
    // Scale threshold with trip duration — need at least 5 places per day
    const minPlacesNeeded = Math.max(10, numDays * 5);
    if (places.length < minPlacesNeeded) {
      logger.info(`     Only ${places.length}/${minPlacesNeeded} places needed — fetching from external APIs...`);
      try {
        const searchResult = await this.searchPlaces({
          location: destination,
          limit: Math.max(30, numDays * 15),
        });
        if (searchResult?.places) {
          const externalPlaces = searchResult.places.map(p => ({
            ...p,
            source: searchResult.source || 'external',
            duration: estimateDuration(p.type),
            cost: estimateCost(p.type, travelStyle),
          }));
          places = [...places, ...externalPlaces];
          logger.info(`     After external search: ${places.length} places total`);
        }
      } catch (searchError) {
        logger.warn('External search failed:', { error: searchError.message });
      }
    }

    // Step 2.1: Google Maps crawl — enrich data when quality is poor or count is low
    // Returns raw text for each place so AI can use it for context
    let googleMapsRawData = [];
    try {
      const nullRatingCount = places.filter(p => p.rating === null || p.rating === undefined).length;
      const nullRatingRatio = places.length > 0 ? nullRatingCount / places.length : 1;
      const needsGoogleMaps = places.length < minPlacesNeeded || nullRatingRatio > 0.5;

      if (needsGoogleMaps) {
        logger.info(`     [GoogleMaps] Triggering crawl (places: ${places.length}/${minPlacesNeeded}, nullRating: ${(nullRatingRatio * 100).toFixed(0)}%)`);

        const gmResult = await googleMapsProvider.searchPlaces(destination, { limit: 20 });

        if (gmResult?.places?.length > 0) {
          let upgraded = 0;
          let added = 0;

          // Pre-filter: remove Google Maps places with coordinates far from destination
          // This prevents places from other cities (e.g., Hanoi results in a Hải Phòng trip)
          let gmPlaces = gmResult.places;
          const existingWithCoords = places.filter(p => p.latitude && p.longitude);
          let destCenter = null;

          if (existingWithCoords.length >= 2) {
            // Use median of existing places as destination center
            const eLats = existingWithCoords.map(p => p.latitude).sort((a, b) => a - b);
            const eLngs = existingWithCoords.map(p => p.longitude).sort((a, b) => a - b);
            destCenter = {
              lat: eLats[Math.floor(eLats.length / 2)],
              lng: eLngs[Math.floor(eLngs.length / 2)],
            };
          } else if (this.mapboxToken) {
            // No existing coords — geocode the destination name itself
            try {
              const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?` +
                `access_token=${this.mapboxToken}&limit=1&types=place,locality,district`;
              const geoResp = await fetch(geoUrl);
              if (geoResp.ok) {
                const geoData = await geoResp.json();
                const feat = geoData.features?.[0];
                if (feat) {
                  destCenter = { lat: feat.center[1], lng: feat.center[0] };
                  logger.info(`     [GoogleMaps] Geocoded destination center: ${destCenter.lat}, ${destCenter.lng}`);
                }
              }
            } catch { /* skip */ }
          }

          if (destCenter) {
            const GM_RADIUS_KM = 50;
            const beforeGmCount = gmPlaces.length;
            gmPlaces = gmPlaces.filter(p => {
              // Keep places without URL coordinates — they'll be geocoded + filtered later
              if (!p.latitude || !p.longitude) return true;
              const dist = haversineDistance(destCenter, { lat: p.latitude, lng: p.longitude });
              return dist <= GM_RADIUS_KM;
            });
            const gmFiltered = beforeGmCount - gmPlaces.length;
            if (gmFiltered > 0) {
              logger.info(`     [GoogleMaps] Pre-filtered ${gmFiltered} places outside ${GM_RADIUS_KM}km radius`);
            }
          }

          // Collect raw data from ALL Google Maps places for AI context
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
            // Find existing place with similar name (strict matching to avoid false positives)
            const gmNameLower = gmPlace.name?.toLowerCase();
            const existing = gmNameLower && places.find(p => {
              if (!p.name) return false;
              const pNameLower = p.name.toLowerCase();
              if (pNameLower === gmNameLower) return true;
              // Require the shorter name to be >= 70% of the longer name's length
              // Prevents "Hải Phòng" (city) from matching "Phố đi bộ Hải Phòng" (place)
              const shorter = Math.min(pNameLower.length, gmNameLower.length);
              const longer = Math.max(pNameLower.length, gmNameLower.length);
              if (shorter < 4 || shorter / longer < 0.7) return false;
              return pNameLower.includes(gmNameLower) || gmNameLower.includes(pNameLower);
            });

            if (existing) {
              // Upgrade null fields on existing place
              if (gmPlace.rating != null && existing.rating == null) existing.rating = gmPlace.rating;
              if (gmPlace.ratingCount != null && existing.ratingCount == null) existing.ratingCount = gmPlace.ratingCount;
              if (gmPlace.openingHours && !existing.openingHours) existing.openingHours = gmPlace.openingHours;
              if (gmPlace.phone && !existing.phone) existing.phone = gmPlace.phone;
              if (gmPlace.website && !existing.website) existing.website = gmPlace.website;
              upgraded++;
            } else {
              // Add as new place
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

          // Step 2.1.5: Detail page crawling for top places
          try {
            const topPlaces = gmPlaces
              .filter(p => p.website?.includes('/maps/place/'))
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .slice(0, 10);

            if (topPlaces.length > 0) {
              logger.info(`     [GoogleMaps] Starting detail crawl for ${topPlaces.length} top places...`);
              const detailMap = await googleMapsProvider.getPlaceDetails(topPlaces);

              // Merge enriched data into googleMapsRawData
              for (const rawEntry of googleMapsRawData) {
                const detail = detailMap.get(rawEntry.name);
                if (detail) rawEntry.enrichedDetail = detail;
              }

              // Save to DB in background
              googleMapsProvider._saveEnrichedToDB(detailMap, destination).catch(() => {});
            }
          } catch (detailError) {
            logger.warn('[GoogleMaps] Detail crawl failed (non-blocking):', detailError.message);
          }
        }
      }
    } catch (gmError) {
      logger.warn('[GoogleMaps] Crawl failed (non-blocking):', { error: gmError.message });
    }

    // Step 2.2: Geocode places without coordinates using Mapbox
    // Google Maps crawl often returns places without lat/lng — TSP solver needs coords
    // IMPORTANT: Verify geocoded coords are near destination — don't blindly trust Mapbox
    if (this.mapboxToken) {
      const noCoordPlaces = places.filter(p => !p.latitude || !p.longitude);
      if (noCoordPlaces.length > 0) {
        logger.info(`     [Geocode] ${noCoordPlaces.length} places missing coordinates, geocoding...`);

        // Get destination center for validation (reuse if already computed above)
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
          // Geocode destination name itself
          try {
            const destUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?` +
              `access_token=${this.mapboxToken}&limit=1&types=place,locality,district`;
            const destResp = await fetch(destUrl);
            if (destResp.ok) {
              const destData = await destResp.json();
              const destFeat = destData.features?.[0];
              if (destFeat) {
                geocodeCenter = { lat: destFeat.center[1], lng: destFeat.center[0] };
              }
            }
          } catch { /* skip */ }
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
                // Include destination for context but verify result afterwards
                const query = `${p.name}, ${destination}, Vietnam`;
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                  `access_token=${this.mapboxToken}&limit=1&language=vi,en&types=poi,address`;
                const resp = await fetch(url);
                if (!resp.ok) return null;
                const data = await resp.json();
                const feature = data.features?.[0];
                if (feature) {
                  const coords = { lat: feature.center[1], lng: feature.center[0] };
                  // Verify: geocoded location must be near destination center
                  if (geocodeCenter) {
                    const dist = haversineDistance(geocodeCenter, coords);
                    if (dist > GEOCODE_RADIUS_KM) return 'rejected';
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
            await new Promise(r => setTimeout(r, 100));
          }
        }
        logger.info(`     [Geocode] Geocoded ${geocoded}/${noCoordPlaces.length} places` +
          (rejected > 0 ? ` (${rejected} rejected — too far from ${destination})` : ''));
      }
    }

    // Step 2.5: Filter out places with coordinates far from destination
    // Prevents places in wrong cities/countries (e.g., Canada in a Hà Nội trip)
    const placesWithCoords = places.filter(p => p.latitude && p.longitude);
    if (placesWithCoords.length >= 3) {
      // Calculate median coordinates as destination center (robust to outliers)
      const lats = placesWithCoords.map(p => p.latitude).sort((a, b) => a - b);
      const lngs = placesWithCoords.map(p => p.longitude).sort((a, b) => a - b);
      const medianLat = lats[Math.floor(lats.length / 2)];
      const medianLng = lngs[Math.floor(lngs.length / 2)];
      const center = { lat: medianLat, lng: medianLng };

      const MAX_RADIUS_KM = 50;
      const beforeCount = places.length;
      places = places.filter(p => {
        if (!p.latitude || !p.longitude) return true; // keep places without coords
        const dist = haversineDistance(center, { lat: p.latitude, lng: p.longitude });
        return dist <= MAX_RADIUS_KM;
      });
      const filtered = beforeCount - places.length;
      if (filtered > 0) {
        logger.info(`     Filtered out ${filtered} places outside ${MAX_RADIUS_KM}km radius`);
      }
    }

    if (places.length === 0) {
      return {
        success: false,
        error: `No places found for destination "${destination}". Try using web_search or search_places first.`,
      };
    }

    // Step 2.6: Fetch weather data internally (so AI doesn't need a separate get_weather call)
    let weatherData = null;
    if (startDate && this.getWeather) {
      try {
        logger.info('     Fetching weather data internally...');
        weatherData = await this.getWeather({ location: destination, date: startDate });
        logger.info(`     Weather: ${weatherData?.condition || 'fetched'}`);
      } catch (weatherError) {
        logger.warn('     Weather fetch failed (optional):', { error: weatherError.message });
      }
    }

    // Step 3: Run TripPlanner algorithm pipeline with profile-enhanced params
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
      },
      places
    );

    logger.info('  ┌─────────────────────────────────────────────────────────┐');
    logger.info('  │  optimize_itinerary: Pipeline Complete                  │');
    logger.info('  └─────────────────────────────────────────────────────────┘');
    logger.info(`     Days: ${itinerary.days?.length}, Places: ${itinerary.summary?.totalPlaces}`);

    // Build weather summary for AI context
    let weatherSummary = null;
    if (weatherData) {
      weatherSummary = {
        condition: weatherData.condition,
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        forecast: weatherData.forecast,
      };
    }

    // Collect unique sources from places used in the itinerary
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

    return {
      success: true,
      itinerary,
      placesUsed: places.length,
      algorithm: itinerary.metadata?.algorithm,
      weather: weatherSummary,
      sources: Array.from(sourceMap.values()),
      // Raw Google Maps data for AI context — use this to enrich trip plan details
      googleMapsData: googleMapsRawData.length > 0 ? googleMapsRawData : undefined,
    };
  } catch (error) {
    logger.error('optimize_itinerary failed:', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create Trip Plan - Signal to create and save trip plan
 *
 * FLOW: Step 5 - Draft Storage (via Tool)
 */
async function createTripPlan(args) {
  const {
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

  try {
    console.log('\n  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  STEP 5: DRAFT STORAGE (via create_trip_plan tool)      │');
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log(`  AI requested trip plan creation:`);
    console.log(`     - Title: ${title}`);
    console.log(`     - Destination: ${destination}`);
    console.log(`     - Dates: ${startDate || 'N/A'} to ${endDate || 'N/A'}`);
    console.log(`     - Travelers: ${travelersCount}`);

    if (!title || !destination) {
      logger.error('  Validation failed: Title and destination are required');
      throw new Error('Title and destination are required');
    }

    if (itineraryData && itineraryData.days) {
      logger.info(`  Itinerary has ${itineraryData.days.length} days`);
      const enrichedDays = await enrichItinerary.call(this, itineraryData.days, destination);

      // Calculate endDate if not provided
      let calculatedEndDate = endDate;
      if (!calculatedEndDate && startDate && itineraryData.days.length > 0) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + itineraryData.days.length - 1);
        calculatedEndDate = end.toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      // Handle budget - AI might send totalEstimatedCost or budget
      const budgetValue = itineraryData.totalEstimatedCost || itineraryData.budget || null;
      const currencyValue = itineraryData.currency || 'VND';

      // ═══════════════════════════════════════════════════════════════
      // Phase 1: Prepare comprehensive draft data
      // ═══════════════════════════════════════════════════════════════
      const draftData = {
        trip: {
          destination,
          title,
          description: description || `Trip to ${destination}`,
          startDate: startDate || null,
          endDate: calculatedEndDate,
          travelers: travelersCount,
        },
        days: enrichedDays,
        budget: typeof budgetValue === 'object' ? budgetValue : { total: budgetValue, currency: currencyValue },
        tips: itineraryData.tips || [],

        // Phase 1: Overview
        overview: overview || null,

        // Phase 1: Travel tips by category
        travelTips: travelTips || null,

        // Phase 1: Budget breakdown by category
        budgetBreakdown: budgetBreakdown || null,

        // Phase 1: Booking suggestions
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
        JSON.stringify({ title, destination, startDate, endDate }),
        draftData
      );

      logger.info(`  Draft created with ID: ${draft.id}`);

      const geocodedCount = enrichedDays.reduce((count, day) => {
        return count + (day.activities?.filter(a => a.coordinates)?.length || 0);
      }, 0);
      const imageCount = enrichedDays.reduce((count, day) => {
        return count + (day.activities?.filter(a => a.image)?.length || 0);
      }, 0);

      // Auto-apply draft if user is authenticated (SKIP Step 6 - User Review)
      if (this.currentUserId) {
        try {
          logger.info('  User authenticated - Auto-applying draft (Skip Step 6 Review)...');
          logger.info('  Proceeding directly to Step 7A: Apply Draft');
          
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
          logger.info('  Falling back to draft-only response');
        }
      } else {
        logger.info('  User not authenticated - Draft only mode');
        logger.info('  Draft ID returned for later application');
      }

      // Return draft if user not authenticated or apply failed
      logger.info('  └─────────────────────────────────────────────────────────┘');
      return {
        success: true,
        action: 'draft_created',
        draftId: draft.id,
        title,
        destination,
        geocodedPlaces: geocodedCount,
        activitiesWithImages: imageCount,
      };
    } else {
      return {
        success: true,
        action: 'signal_intent',
        title,
        destination,
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

/**
 * Enrich itinerary with both coordinates and images
 */
async function enrichItinerary(days, destination) {
  let enrichedDays = await enrichItineraryWithCoordinates.call(this, days, destination);
  enrichedDays = await enrichItineraryWithImages(enrichedDays, destination);
  return enrichedDays;
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
      batch.map(loc => geocodeLocationForItinerary.call(this, loc, destination))
    );

    batch.forEach((loc, idx) => {
      locationMap.set(loc, results[idx]);
    });

    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
async function geocodeLocationForItinerary(location, context) {
  try {
    // Clean up location string and build better search query
    const cleanLocation = location
      .replace(/TP\.HCM|TP HCM|TPHCM/gi, 'Thành phố Hồ Chí Minh')
      .replace(/HCM/gi, 'Hồ Chí Minh');

    // Build search query - prefer location with context
    let searchQuery = cleanLocation;
    if (context && !cleanLocation.toLowerCase().includes(context.toLowerCase().split(',')[0])) {
      searchQuery = `${cleanLocation}, ${context}`;
    }

    // Add Vietnam to ensure correct country
    if (!searchQuery.toLowerCase().includes('việt nam') && !searchQuery.toLowerCase().includes('vietnam')) {
      searchQuery = `${searchQuery}, Vietnam`;
    }

    // Detect country from context for bbox filtering
    const isVietnam = context?.toLowerCase().includes('việt nam') ||
                      context?.toLowerCase().includes('vietnam') ||
                      context?.toLowerCase().includes('hồ chí minh') ||
                      context?.toLowerCase().includes('hà nội') ||
                      context?.toLowerCase().includes('đà nẵng');

    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
      `access_token=${this.mapboxToken}&limit=3&language=vi,en`;

    // Add country filter for Vietnam
    if (isVietnam) {
      url += '&country=VN';
    }

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Find the best matching result
    // Prefer results that contain the location name and are in the expected area
    const feature = findBestGeocodingResult(data.features, location, context);

    if (feature) {
      return {
        lat: feature.center[1],
        lng: feature.center[0],
        placeName: feature.place_name,
        placeType: feature.place_type?.[0] || 'unknown',
      };
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

  const locationLower = originalLocation.toLowerCase();
  const contextLower = context?.toLowerCase() || '';

  // Score each feature
  const scored = features.map(f => {
    let score = 0;
    const placeName = f.place_name?.toLowerCase() || '';

    // Check if place name contains key parts of original location
    const locationParts = locationLower.split(/[,\s]+/).filter(p => p.length > 2);
    locationParts.forEach(part => {
      if (placeName.includes(part)) score += 10;
    });

    // Check if context is in place name
    if (contextLower && placeName.includes(contextLower.split(',')[0])) {
      score += 5;
    }

    // Prefer more specific place types
    const placeType = f.place_type?.[0];
    if (placeType === 'poi') score += 8;
    if (placeType === 'address') score += 6;
    if (placeType === 'neighborhood') score += 4;
    if (placeType === 'locality') score += 2;

    // Penalize if place type is too generic
    if (placeType === 'place' || placeType === 'region' || placeType === 'country') {
      score -= 5;
    }

    return { feature: f, score };
  });

  // Sort by score descending
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
      // Prefer Google Maps photos over Pexels when available
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
  // If Pexels API key is available, try to get contextual images
  if (PEXELS_API_KEY) {
    try {
      const searchTerms = buildImageSearchTerms(activity, destination);
      const cacheKey = `${searchTerms}_${width}x${height}`;

      // Check cache first
      if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
      }

      const pexelsImage = await fetchPexelsImage(searchTerms, width, height);
      if (pexelsImage) {
        const result = {
          image: pexelsImage.large,
          thumbnail: pexelsImage.medium,
        };
        imageCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn('Pexels API failed, falling back to placeholder:', error.message);
    }
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
async function fetchPexelsImage(query, _width, _height) {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: PEXELS_API_KEY,
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

  const uniqueTerms = [...new Set(terms.map(t => t.toLowerCase()))];
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
