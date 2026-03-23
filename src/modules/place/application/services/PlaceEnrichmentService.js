import serperService from '../../../ai/infrastructure/services/SerperService.js';
import placeRepository from '../../infrastructure/repositories/PlaceRepository.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const BASIC_CACHE_DAYS = 30;
const FULL_CACHE_DAYS = 7;

class PlaceEnrichmentService {
  /**
   * Level 1: Basic enrichment for a list of activities.
   * Called during draft compilation.
   */
  async enrichActivitiesBasic(activities, destination) {
    const results = [];

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < activities.length; i += 5) {
      const batch = activities.slice(i, i + 5);
      const promises = batch.map((activity) =>
        this.#enrichSingleBasic(activity, destination).catch((err) => {
          logger.warn('[Enrichment] Basic enrichment failed', {
            activity: activity.name,
            error: err.message,
          });
          return null;
        })
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  async #enrichSingleBasic(activity, destination) {
    const query = `${activity.name} ${destination}`;

    const { places } = await serperService.searchPlaces({
      query,
      skipCache: false,
    });

    if (!places || places.length === 0) return null;

    const best = places[0];

    // Also fetch images
    let photos = [];
    try {
      const imageResult = await serperService.searchImages({
        query: `${activity.name} ${destination}`,
        limit: 3,
      });
      if (imageResult?.images) {
        photos = imageResult.images.map((img) => img.url);
      }
    } catch {
      // Images are optional
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + BASIC_CACHE_DAYS);

    const place = await placeRepository.upsertPlace({
      provider: 'serper',
      externalId: best.cid || `serper-${query.replace(/\s+/g, '-')}`,
      name: best.name,
      address: best.address || '',
      city: destination,
      latitude: best.latitude,
      longitude: best.longitude,
      rating: best.rating,
      ratingCount: best.ratingCount,
      phone: best.phone,
      website: best.website,
      categories: best.category ? [best.category] : [],
      photos,
      type: this.#inferPlaceType(activity.type),
      expiresAt,
    });

    return { activityName: activity.name, placeId: place.id, place };
  }

  /**
   * Level 2: Full enrichment for a single place (on-demand).
   */
  async enrichPlaceFull(placeId) {
    const place = await placeRepository.findById(placeId);
    if (!place) return null;

    // Check cache
    if (
      place.enrichedData &&
      place.expiresAt &&
      place.expiresAt > new Date()
    ) {
      return place;
    }

    const query = `${place.name} ${place.city || ''}`.trim();

    let enrichedData = place.enrichedData || {};

    try {
      const webResult = await serperService.search({
        query: `${query} opening hours reviews`,
        limit: 5,
      });

      if (webResult.knowledgeGraph) {
        const kg = webResult.knowledgeGraph;
        enrichedData = {
          ...enrichedData,
          openingHours: kg.attributes?.Hours || null,
          description: kg.description || null,
          website: kg.website || place.website,
          phone: kg.phone || place.phone,
          reviewSnippets: [],
        };
      }

      if (webResult.results) {
        const reviewSnippets = webResult.results
          .filter(
            (r) =>
              r.content &&
              (r.url.includes('tripadvisor') ||
                r.url.includes('google.com/maps') ||
                r.url.includes('yelp'))
          )
          .slice(0, 3)
          .map((r) => ({
            text: r.content,
            source: r.url,
            title: r.title,
          }));

        if (reviewSnippets.length > 0) {
          enrichedData.reviewSnippets = reviewSnippets;
        }
      }
    } catch (err) {
      logger.warn('[Enrichment] Full enrichment failed', {
        placeId,
        error: err.message,
      });
    }

    // Fetch additional images if current photos are sparse
    if (!place.photos || place.photos.length < 3) {
      try {
        const imageResult = await serperService.searchImages({
          query,
          limit: 5,
        });
        if (imageResult?.images) {
          const newPhotos = imageResult.images.map((img) => img.url);
          const allPhotos = [...(place.photos || []), ...newPhotos];
          const uniquePhotos = [...new Set(allPhotos)].slice(0, 8);
          await placeRepository.upsertPlace({
            provider: place.provider,
            externalId: place.externalId,
            name: place.name,
            type: place.type,
            address: place.address,
            city: place.city,
            country: place.country,
            countryCode: place.countryCode,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            ratingCount: place.ratingCount,
            priceLevel: place.priceLevel,
            phone: place.phone,
            website: place.website,
            openingHours: place.openingHours,
            categories: place.categories,
            enrichedData: place.enrichedData,
            expiresAt: place.expiresAt,
            photos: uniquePhotos,
          });
        }
      } catch {
        // Images are optional
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + FULL_CACHE_DAYS);

    const updated = await placeRepository.updateEnrichedData(
      placeId,
      enrichedData,
      expiresAt
    );

    return updated;
  }

  /**
   * Search for places near coordinates.
   */
  async searchPlaces(query, lat, lng) {
    // First check local cache
    if (lat && lng) {
      const cached = await placeRepository.searchNearby(query, lat, lng);
      if (cached.length >= 5) return cached;
    }

    // Fallback to Serper
    const serperQuery =
      lat && lng ? `${query} near ${lat},${lng}` : query;

    const { places } = await serperService.searchPlaces({
      query: serperQuery,
    });

    // Upsert results into cache
    const upserted = [];
    for (const p of places || []) {
      try {
        const place = await placeRepository.upsertPlace({
          provider: 'serper',
          externalId: p.cid || `serper-${p.name}-${p.address}`,
          name: p.name,
          address: p.address || '',
          latitude: p.latitude,
          longitude: p.longitude,
          rating: p.rating,
          ratingCount: p.ratingCount,
          phone: p.phone,
          website: p.website,
          categories: p.category ? [p.category] : [],
          photos: [],
          type: 'OTHER',
        });
        upserted.push(place);
      } catch {
        // Skip duplicates
      }
    }

    return upserted;
  }

  #inferPlaceType(activityType) {
    const typeMap = {
      HOTEL: 'HOTEL',
      ACCOMMODATION: 'HOTEL',
      RESTAURANT: 'RESTAURANT',
      DINING: 'RESTAURANT',
      ATTRACTION: 'ATTRACTION',
      ACTIVITY: 'ACTIVITY',
      TRANSPORT: 'TRANSPORT',
      TRANSPORTATION: 'TRANSPORT',
    };
    return typeMap[activityType] || 'OTHER';
  }
}

export default new PlaceEnrichmentService();
