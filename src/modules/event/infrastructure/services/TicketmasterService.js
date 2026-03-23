/**
 * Ticketmaster Discovery API Service
 * Fetches and normalizes event data from Ticketmaster
 */

import axios from 'axios';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events';
const REQUEST_TIMEOUT_MS = 10_000;
const PROVIDER = 'ticketmaster';

/**
 * Pick the widest image from a Ticketmaster images array.
 */
function pickBestImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0].url || null;
}

/**
 * Build a human-readable price range string.
 */
function formatPriceRange(priceRanges) {
  if (!Array.isArray(priceRanges) || priceRanges.length === 0) return null;
  const { min, max, currency } = priceRanges[0];
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}-${max} ${currency || ''}`.trim();
  if (min != null) return `${min}+ ${currency || ''}`.trim();
  return `Up to ${max} ${currency || ''}`.trim();
}

/**
 * Extract the primary classification category.
 */
function extractCategory(classifications) {
  if (!Array.isArray(classifications) || classifications.length === 0) {
    return null;
  }
  const c = classifications[0];
  const segment = c.segment?.name;
  const genre = c.genre?.name;
  if (segment && genre) return `${segment} - ${genre}`;
  return segment || genre || null;
}

/**
 * Map a single Ticketmaster event to our local_events schema.
 */
function normalizeEvent(raw) {
  const venue = raw._embedded?.venues?.[0];
  const startDateTime = raw.dates?.start?.dateTime || null;
  const endDateTime = raw.dates?.end?.dateTime || null;

  return {
    externalId: raw.id,
    provider: PROVIDER,
    title: raw.name,
    description: raw.info || raw.pleaseNote || null,
    startTime: startDateTime ? new Date(startDateTime) : null,
    endTime: endDateTime ? new Date(endDateTime) : null,
    venue: venue?.name || null,
    address: venue?.address?.line1 || null,
    city: venue?.city?.name || null,
    countryCode: venue?.country?.countryCode || null,
    latitude: venue?.location?.latitude
      ? parseFloat(venue.location.latitude)
      : null,
    longitude: venue?.location?.longitude
      ? parseFloat(venue.location.longitude)
      : null,
    category: extractCategory(raw.classifications),
    ticketUrl: raw.url || null,
    priceRange: formatPriceRange(raw.priceRanges),
    imageUrl: pickBestImage(raw.images),
  };
}

class TicketmasterService {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Search events via the Ticketmaster Discovery API.
   * Returns an empty array when the API key is missing.
   */
  async searchEvents({
    city,
    startDate,
    endDate,
    keyword,
    category,
    page = 0,
    size = 20,
  }) {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      return [];
    }

    const params = {
      apikey: apiKey,
      size: Math.min(size, 200),
      page,
    };
    if (city) params.city = city;
    if (startDate) params.startDateTime = startDate;
    if (endDate) params.endDateTime = endDate;
    if (keyword) params.keyword = keyword;
    if (category) params.classificationName = category;

    let response;
    try {
      response = await this.client.get('.json', { params });
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.fault?.faultstring
        || error.response?.data?.errors?.[0]?.detail
        || error.message;
      console.error(
        `[Ticketmaster] API request failed (${status || 'network'}): ${msg}`,
      );
      return [];
    }

    const events = response.data?._embedded?.events;
    if (!Array.isArray(events)) {
      return [];
    }

    return events
      .map(normalizeEvent)
      .filter((e) => e.startTime !== null && e.city !== null);
  }
}

export default new TicketmasterService();
