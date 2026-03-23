import api from '@/src/lib/api';

// ============================================
// Types
// ============================================

export interface LocalEvent {
  id: string;
  externalId: string | null;
  provider: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  venue: string | null;
  address: string | null;
  city: string;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  ticketUrl: string | null;
  priceRange: string | null;
  imageUrl: string | null;
}

export interface EventPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface SearchEventsParams {
  city: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface NearbyEventsParams {
  latitude: number;
  longitude: number;
  radius?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface EventListResponse {
  events: LocalEvent[];
  pagination: EventPagination;
}

interface TripEventsCity {
  cityName: string;
  events: LocalEvent[];
}

// ============================================
// Event Service
// ============================================

class EventService {
  async searchEvents(
    params: SearchEventsParams,
  ): Promise<EventListResponse> {
    const response = await api.get<
      ApiResponse<EventListResponse>
    >('/events/search', { params });
    return response.data.data;
  }

  async searchNearby(
    params: NearbyEventsParams,
  ): Promise<EventListResponse> {
    const response = await api.get<
      ApiResponse<EventListResponse>
    >('/events/nearby', { params });
    return response.data.data;
  }

  async getEvent(eventId: string): Promise<LocalEvent> {
    const response = await api.get<
      ApiResponse<{ event: LocalEvent }>
    >(`/events/${eventId}`);
    return response.data.data.event;
  }

  async getTripEvents(
    tripId: string,
  ): Promise<TripEventsCity[]> {
    const response = await api.get<
      ApiResponse<{ events: TripEventsCity[] }>
    >(`/events/trips/${tripId}/events`);
    return response.data.data.events;
  }
}

export const eventService = new EventService();
export default eventService;
