/**
 * Amadeus Flight Search Service
 * Handles OAuth2 token management and flight offer searches
 */

import axios from 'axios';

const TOKEN_URL = 'https://api.amadeus.com/v1/security/oauth2/token';
const FLIGHT_OFFERS_URL =
  'https://api.amadeus.com/v2/shopping/flight-offers';
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

const CABIN_CLASS_MAP = {
  economy: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  first: 'FIRST',
};

let cachedToken = null;
let tokenExpiresAt = 0;

class AmadeusService {
  constructor() {
    this.client = axios.create({ timeout: REQUEST_TIMEOUT_MS });
  }

  /**
   * Fetch a new OAuth2 access token from Amadeus.
   */
  async fetchToken() {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await this.client.post(TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, expires_in } = response.data;
    cachedToken = access_token;
    tokenExpiresAt = Date.now() + expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS;

    return access_token;
  }

  /**
   * Return a valid access token, refreshing if expired or missing.
   */
  async getToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }
    return this.fetchToken();
  }

  /**
   * Search flights via the Amadeus Flight Offers API.
   * Returns normalized results or an empty array when
   * credentials are not configured.
   */
  async searchFlights({
    origin,
    destination,
    departDate,
    returnDate,
    passengers = 1,
    cabinClass = 'economy',
  }) {
    const token = await this.getToken();

    if (!token) {
      return {
        flights: [],
        message: 'Amadeus API credentials are not configured',
      };
    }

    const travelClass =
      CABIN_CLASS_MAP[cabinClass] || CABIN_CLASS_MAP.economy;

    const params = {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departDate,
      adults: passengers,
      travelClass,
      max: 10,
    };

    if (returnDate) {
      params.returnDate = returnDate;
    }

    let response;
    try {
      response = await this.client.get(FLIGHT_OFFERS_URL, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      const status = error.response?.status;

      if (status === 401) {
        cachedToken = null;
        tokenExpiresAt = 0;
      }

      const msg = error.response?.data?.errors?.[0]?.detail || error.message;
      throw new Error(
        `Amadeus API request failed (${status || 'network'}): ${msg}`
      );
    }

    const offers = response.data?.data || [];
    return { flights: offers.map(normalizeOffer) };
  }
}

/**
 * Transform a raw Amadeus flight offer into a
 * flattened structure suitable for the frontend.
 */
function normalizeOffer(offer) {
  const itineraries = (offer.itineraries || []).map((itin) => ({
    duration: itin.duration,
    segments: (itin.segments || []).map((seg) => ({
      departure: seg.departure,
      arrival: seg.arrival,
      carrierCode: seg.carrierCode,
      flightNumber: `${seg.carrierCode}${seg.number}`,
      aircraft: seg.aircraft?.code || null,
      duration: seg.duration,
      numberOfStops: seg.numberOfStops,
    })),
  }));

  return {
    id: offer.id,
    itineraries,
    price: {
      total: offer.price?.total || null,
      currency: offer.price?.currency || null,
      grandTotal: offer.price?.grandTotal || null,
    },
    numberOfBookableSeats: offer.numberOfBookableSeats ?? null,
  };
}

export default new AmadeusService();
