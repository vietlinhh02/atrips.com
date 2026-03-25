import serperService from '../../../ai/infrastructure/services/SerperService.js';
import placeRepository from '../../infrastructure/repositories/PlaceRepository.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const BASIC_CACHE_DAYS = 30;
const FULL_CACHE_DAYS = 7;
const BASIC_IMAGE_LIMIT = 6;
const FULL_IMAGE_LIMIT = 8;
const MAX_PHOTOS_PER_PLACE = 10;

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

    // Fetch images with higher limit for better coverage
    let photos = [];
    try {
      const imageResult = await serperService.searchImages({
        query: `${activity.name} ${destination} travel`,
        limit: BASIC_IMAGE_LIMIT,
      });
      if (imageResult?.images) {
        photos = imageResult.images
          .filter((img) => img.url && !img.url.includes('logo'))
          .map((img) => img.url);
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

    // Run web search and image search in parallel for speed
    const [webSearchResult, imageSearchResult] = await Promise.allSettled([
      this.#fetchWebEnrichment(query, place),
      this.#fetchImageEnrichment(query, place),
    ]);

    // Apply web enrichment results
    if (webSearchResult.status === 'fulfilled' && webSearchResult.value) {
      enrichedData = { ...enrichedData, ...webSearchResult.value };
    }

    // Apply image enrichment results
    if (imageSearchResult.status === 'fulfilled' && imageSearchResult.value) {
      const uniquePhotos = imageSearchResult.value;
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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + FULL_CACHE_DAYS);

    const updated = await placeRepository.updateEnrichedData(
      placeId,
      enrichedData,
      expiresAt
    );

    return updated;
  }

  async #fetchWebEnrichment(query, place) {
    try {
      const reviewSources = ['tripadvisor', 'google.com/maps', 'yelp', 'foursquare', 'booking.com'];
      const data = {};

      // Two searches in parallel: one for KG/reviews, one for description
      const [kgResult, descResult] = await Promise.allSettled([
        serperService.search({
          query: `${query} reviews opening hours`,
          limit: 10,
        }),
        serperService.search({
          query: `"${place.name}" about description`,
          limit: 5,
        }),
      ]);

      // Process knowledge graph result
      const webResult = kgResult.status === 'fulfilled' ? kgResult.value : null;
      if (webResult?.knowledgeGraph) {
        const kg = webResult.knowledgeGraph;
        data.openingHours = kg.attributes?.Hours || kg.attributes?.['Opening Hours'] || null;
        data.description = kg.description || null;
        data.website = kg.website || place.website;
        data.phone = kg.phone || place.phone;

        if (kg.attributes?.['Price range'] || kg.attributes?.Price) {
          data.priceRange = kg.attributes['Price range'] || kg.attributes.Price;
        }
      }

      // Extract review snippets
      if (webResult?.results) {
        const reviewSnippets = webResult.results
          .filter(
            (r) =>
              r.content &&
              r.content.length > 30 &&
              reviewSources.some((src) => r.url.includes(src))
          )
          .slice(0, 5)
          .map((r) => ({
            text: r.content,
            source: r.url,
            title: r.title,
          }));

        if (reviewSnippets.length > 0) {
          data.reviewSnippets = reviewSnippets;
        }
      }

      // Build description from dedicated search if KG description is missing or truncated
      if (!data.description || data.description.length < 80) {
        const descWeb = descResult.status === 'fulfilled' ? descResult.value : null;
        const allResults = [
          ...(descWeb?.results || []),
          ...(webResult?.results || []),
        ];

        // Find the longest non-review snippet as description
        const bestDesc = allResults
          .filter(
            (r) =>
              r.content &&
              r.content.length > 60 &&
              !reviewSources.some((src) => r.url.includes(src))
          )
          .sort((a, b) => b.content.length - a.content.length)[0];

        if (bestDesc && bestDesc.content.length > (data.description?.length || 0)) {
          data.description = bestDesc.content;
        }
      }

      return Object.keys(data).length > 0 ? data : null;
    } catch (err) {
      logger.warn('[Enrichment] Web enrichment failed', {
        query,
        error: err.message,
      });
      return null;
    }
  }

  async #fetchImageEnrichment(query, place) {
    if (place.photos && place.photos.length >= 5) return null;

    try {
      const imageResult = await serperService.searchImages({
        query: `${query} travel photography`,
        limit: FULL_IMAGE_LIMIT,
      });
      if (!imageResult?.images) return null;

      const newPhotos = imageResult.images
        .filter((img) => img.url && !img.url.includes('logo') && !img.url.includes('icon'))
        .map((img) => img.url);
      const allPhotos = [...(place.photos || []), ...newPhotos];
      return [...new Set(allPhotos)].slice(0, MAX_PHOTOS_PER_PLACE);
    } catch {
      return null;
    }
  }

  /**
   * Batch full-enrich all places by ID (fire-and-forget safe).
   * Called when user saves a trip plan.
   */
  async enrichPlacesBatch(placeIds) {
    const unique = [...new Set(placeIds.filter(Boolean))];
    if (unique.length === 0) return;

    logger.info(`[Enrichment] Batch enriching ${unique.length} places`);

    // Process 3 at a time to avoid rate limits
    for (let i = 0; i < unique.length; i += 3) {
      const batch = unique.slice(i, i + 3);
      await Promise.allSettled(
        batch.map((id) =>
          this.enrichPlaceFull(id).catch((err) => {
            logger.warn('[Enrichment] Batch item failed', {
              placeId: id,
              error: err.message,
            });
          })
        )
      );
    }

    logger.info(`[Enrichment] Batch enrichment complete`);
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
