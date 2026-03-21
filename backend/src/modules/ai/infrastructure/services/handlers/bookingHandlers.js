/**
 * Booking Handlers
 * Handles flights, hotels, and local events search
 */

import prisma from '../../../../../config/database.js';
import cacheService from '../../../../../shared/services/CacheService.js';
import { geocodeLocation } from './infoHandlers.js';
import { searchFlightsViaSearxng, searchHotelsViaSearxng, searchLocalEventsViaSearxng } from './webScraperHandlers.js';
import serperService from '../SerperService.js';

// Cache TTL for tool results (in seconds)
const TOOL_CACHE_TTL = {
  FLIGHTS: 900,       // 15 minutes
  HOTELS: 1800,       // 30 minutes
  EVENTS: 3600,       // 1 hour
};

/**
 * Create booking handlers bound to executor context
 */
export function createBookingHandlers(executor) {
  return {
    searchFlights: searchFlights.bind(executor),
    searchHotels: searchHotels.bind(executor),
    getLocalEvents: getLocalEvents.bind(executor),
  };
}

/**
 * Search Flights - Amadeus API
 */
async function searchFlights(args) {
  const { origin, destination, departure_date, return_date, passengers = 1 } = args;

  const cacheKey = `tool:flights:${origin}:${destination}:${departure_date}:${return_date || 'oneway'}:${passengers}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  if (this.amadeusClientId && this.amadeusClientSecret) {
    try {
      const token = await getAmadeusToken.call(this);
      if (token) {
        const flights = await searchAmadeusFlights.call(
          this, origin, destination, departure_date, return_date, passengers, token
        );
        if (flights) {
          await cacheService.set(cacheKey, flights, TOOL_CACHE_TTL.FLIGHTS);
          return flights;
        }
      }
    } catch (error) {
      console.error('Amadeus API error:', error.message);
    }
  }

  // Try Serper (Google search) — best web results
  if (serperService.isAvailable) {
    try {
      console.log('[Serper] Google search for flights');
      const serperResult = await serperService.searchFlights({
        origin, destination,
        departureDate: departure_date,
        returnDate: return_date,
        passengers,
      });
      if (serperResult?.results?.length > 0) {
        const result = {
          source: 'serper',
          origin,
          destination,
          departureDate: departure_date,
          returnDate: return_date,
          passengers,
          searchResults: serperResult.results.map(r => ({
            title: r.title,
            url: r.url,
            content: r.content || '',
            snippet: (r.content || '').substring(0, 300),
            site: r.url ? new URL(r.url).hostname.replace('www.', '') : '',
          })),
          knowledgeGraph: serperResult.knowledgeGraph || null,
          bookingLinks: serperResult.results
            .filter(r => r.url)
            .map(r => ({
              site: r.url ? new URL(r.url).hostname.replace('www.', '') : '',
              url: r.url,
            })),
        };
        await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.FLIGHTS);
        return result;
      }
    } catch (error) {
      console.error('Serper flight search failed:', error.message);
    }
  }

  // Fallback: SearXNG web search
  console.log('[SearXNG] Web search for flights');
  try {
    return await searchFlightsViaSearxng(args);
  } catch (error) {
    console.error('SearXNG flight search failed:', error.message);
  }

  return searchFlightsFallback(origin, destination, departure_date, return_date, passengers);
}

async function getAmadeusToken() {
  if (this.amadeusToken && this.amadeusTokenExpiry && Date.now() < this.amadeusTokenExpiry) {
    return this.amadeusToken;
  }

  try {
    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${this.amadeusClientId}&client_secret=${this.amadeusClientSecret}`,
    });

    if (response.ok) {
      const data = await response.json();
      this.amadeusToken = data.access_token;
      this.amadeusTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      return this.amadeusToken;
    }
  } catch (error) {
    console.error('Amadeus token error:', error.message);
  }

  return null;
}

async function searchAmadeusFlights(origin, destination, departureDate, returnDate, passengers, token) {
  try {
    const originCode = await getAirportCode(origin, token);
    const destCode = await getAirportCode(destination, token);

    if (!originCode || !destCode) {
      return null;
    }

    let url = `https://test.api.amadeus.com/v2/shopping/flight-offers?` +
      `originLocationCode=${originCode}&destinationLocationCode=${destCode}` +
      `&departureDate=${departureDate}&adults=${passengers}&max=5&currencyCode=VND`;

    if (returnDate) {
      url += `&returnDate=${returnDate}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      source: 'amadeus',
      origin,
      destination,
      originCode,
      destinationCode: destCode,
      departureDate,
      returnDate,
      passengers,
      flights: data.data?.slice(0, 5).map(offer => ({
        id: offer.id,
        price: parseFloat(offer.price.total),
        currency: offer.price.currency,
        segments: offer.itineraries.map(itin => ({
          duration: itin.duration,
          segments: itin.segments.map(seg => ({
            departure: {
              airport: seg.departure.iataCode,
              time: seg.departure.at,
            },
            arrival: {
              airport: seg.arrival.iataCode,
              time: seg.arrival.at,
            },
            airline: seg.carrierCode,
            flightNumber: seg.carrierCode + seg.number,
            duration: seg.duration,
          })),
        })),
      })) || [],
    };
  } catch (error) {
    console.error('Amadeus flight search error:', error.message);
    return null;
  }
}

async function getAirportCode(location, token) {
  try {
    const response = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations?` +
      `keyword=${encodeURIComponent(location)}&subType=AIRPORT,CITY&page[limit]=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.data?.[0]?.iataCode;
    }
  } catch (error) {
    console.warn('Failed to get airport IATA code:', error.message);
  }
  return null;
}

function searchFlightsFallback(origin, destination, departureDate, returnDate, passengers) {
  return {
    success: false,
    source: 'fallback',
    origin,
    destination,
    departureDate,
    returnDate,
    passengers,
    flights: [],
    error: 'Chưa cấu hình API tìm vé máy bay (Amadeus) hoặc không tìm thấy chuyến bay cho ngày này. Vui lòng thử ngày khác.',
    note: 'DO NOT hallucinate flight data. Inform the user flights are not available.',
  };
}

/**
 * Search Hotels - RapidAPI/Booking
 */
async function searchHotels(args) {
  const { location, check_in, check_out, guests = 2, budget } = args;

  const cacheKey = `tool:hotels:${location}:${check_in}:${check_out}:${guests}:${budget || 'all'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  if (this.rapidApiKey) {
    try {
      const hotels = await searchRapidAPIHotels.call(this, location, check_in, check_out, guests, budget);
      if (hotels) {
        await cacheService.set(cacheKey, hotels, TOOL_CACHE_TTL.HOTELS);
        return hotels;
      }
    } catch (error) {
      console.error('RapidAPI Hotels error:', error.message);
    }
  }

  // Try SearXNG web search as alternative
  console.log('[SearXNG] Web search for hotels');
  try {
    return await searchHotelsViaSearxng(args);
  } catch (error) {
    console.error('SearXNG hotel search failed:', error.message);
  }

  return searchHotelsFallback(location, check_in, check_out, guests, budget);
}

async function searchRapidAPIHotels(location, checkIn, checkOut, guests, budget) {
  try {
    const locationResponse = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(location)}&locale=vi`,
      {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
        },
      }
    );

    if (!locationResponse.ok) return null;

    const locations = await locationResponse.json();
    const destId = locations[0]?.dest_id;
    const destType = locations[0]?.dest_type;

    if (!destId) return null;

    const hotelsResponse = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?` +
      `dest_id=${destId}&dest_type=${destType}` +
      `&checkin_date=${checkIn}&checkout_date=${checkOut}` +
      `&adults_number=${guests}&room_number=1` +
      `&order_by=popularity&locale=vi&currency=VND&units=metric`,
      {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
        },
      }
    );

    if (!hotelsResponse.ok) return null;

    const data = await hotelsResponse.json();

    let hotels = data.result || [];
    if (budget) {
      const maxPrice = budget === 'luxury' ? Infinity : budget === 'mid-range' ? 3000000 : 1500000;
      hotels = hotels.filter(hotel => hotel.min_total_price <= maxPrice);
    }

    return {
      source: 'booking',
      location,
      checkIn,
      checkOut,
      guests,
      hotels: hotels.slice(0, 5).map(hotel => ({
        name: hotel.hotel_name,
        rating: hotel.review_score,
        reviewCount: hotel.review_nr,
        pricePerNight: hotel.min_total_price,
        currency: hotel.currency_code || 'VND',
        address: hotel.address,
        district: hotel.district,
        amenities: [],
        image: hotel.main_photo_url,
        bookingUrl: hotel.url,
      })) || [],
    };
  } catch (error) {
    console.error('Booking.com API error:', error.message);
    return null;
  }
}

function searchHotelsFallback(location, checkIn, checkOut, guests, budget) {
  return {
    success: false,
    source: 'fallback',
    location,
    checkIn,
    checkOut,
    guests,
    budget: budget || 'all',
    hotels: [],
    error: `Không tìm thấy khách sạn tại ${location} cho ngày này. Có thể do chưa cấu hình RapidAPI Key hoặc nền tảng Booking đang lỗi.`,
    note: 'DO NOT hallucinate hotel data. Ask the user if they want to choose a different location or check accommodations manually.',
  };
}

/**
 * Get Local Events - Ticketmaster API
 */
async function getLocalEvents(args) {
  const { location, date_from, date_to, category } = args;

  const cacheKey = `tool:events:${location}:${date_from || 'now'}:${date_to || 'week'}:${category || 'all'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const dbEvents = await getEventsFromDB(location, date_from, date_to, category);
  if (dbEvents.length > 0) {
    const result = { source: 'database', location, events: dbEvents };
    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.EVENTS);
    return result;
  }

  if (this.ticketmasterKey) {
    try {
      const events = await searchTicketmasterEvents.call(this, location, date_from, date_to, category);
      if (events) {
        await cacheService.set(cacheKey, events, TOOL_CACHE_TTL.EVENTS);
        return events;
      }
    } catch (error) {
      console.error('Ticketmaster API error:', error.message);
    }
  }

  // Try SearXNG web search as alternative
  console.log('[SearXNG] Web search for events');
  try {
    return await searchLocalEventsViaSearxng(args);
  } catch (error) {
    console.error('SearXNG event search failed:', error.message);
  }

  return getEventsFallback(location, date_from, date_to, category);
}

async function getEventsFromDB(location, dateFrom, dateTo, category) {
  try {
    return await prisma.local_events.findMany({
      where: {
        city: { contains: location, mode: 'insensitive' },
        ...(dateFrom && { startTime: { gte: new Date(dateFrom) } }),
        ...(dateTo && { startTime: { lte: new Date(dateTo) } }),
        ...(category && { category }),
      },
      take: 10,
      orderBy: { startTime: 'asc' },
    });
  } catch (error) {
    console.warn('Failed to fetch events from database:', error.message);
    return [];
  }
}

async function searchTicketmasterEvents(location, dateFrom, dateTo, category) {
  try {
    const coords = await geocodeLocation.call(this, location);

    let url = `https://app.ticketmaster.com/discovery/v2/events.json?` +
      `apikey=${this.ticketmasterKey}&locale=*&size=10`;

    if (coords) {
      url += `&latlong=${coords.lat},${coords.lng}&radius=50&unit=km`;
    } else {
      url += `&keyword=${encodeURIComponent(location)}`;
    }

    if (dateFrom) {
      url += `&startDateTime=${dateFrom}T00:00:00Z`;
    }

    if (dateTo) {
      url += `&endDateTime=${dateTo}T23:59:59Z`;
    }

    if (category) {
      const segmentId = mapCategoryToTicketmaster(category);
      if (segmentId) {
        url += `&segmentId=${segmentId}`;
      }
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    return {
      source: 'ticketmaster',
      location,
      dateRange: { from: dateFrom, to: dateTo },
      events: data._embedded?.events?.map(event => ({
        title: event.name,
        description: event.info || event.pleaseNote,
        startTime: event.dates.start.dateTime || event.dates.start.localDate,
        venue: event._embedded?.venues?.[0]?.name,
        address: event._embedded?.venues?.[0]?.address?.line1,
        city: event._embedded?.venues?.[0]?.city?.name,
        category: event.classifications?.[0]?.segment?.name,
        priceRange: event.priceRanges ?
          `${event.priceRanges[0].min} - ${event.priceRanges[0].max} ${event.priceRanges[0].currency}` :
          'Liên hệ',
        ticketUrl: event.url,
        image: event.images?.[0]?.url,
      })) || [],
    };
  } catch (error) {
    console.error('Ticketmaster search error:', error.message);
    return null;
  }
}

function mapCategoryToTicketmaster(category) {
  const mapping = {
    music: 'KZFzniwnSyZfZ7v7nJ',
    sports: 'KZFzniwnSyZfZ7v7nE',
    art: 'KZFzniwnSyZfZ7v7na',
    film: 'KZFzniwnSyZfZ7v7nn',
    food: null,
    culture: 'KZFzniwnSyZfZ7v7na',
    festival: 'KZFzniwnSyZfZ7v7nJ',
  };
  return mapping[category];
}

function getEventsFallback(location, dateFrom, dateTo, category) {
  return {
    success: false,
    source: 'fallback',
    location,
    dateRange: { from: dateFrom, to: dateTo },
    events: [],
    error: `Không tìm thấy sự kiện nào tại ${location}. Vui lòng cấu hình Ticketmaster API để có thông tin sự kiện.`,
    note: 'DO NOT hallucinate events. Inform the user no events were found.',
  };
}
