import api from '@/src/lib/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FlightSegment {
  departure: { iataCode: string; terminal?: string; at: string };
  arrival: { iataCode: string; terminal?: string; at: string };
  carrierCode: string;
  number: string;
  aircraft?: { code: string };
  duration: string;
  numberOfStops: number;
}

export interface FlightItinerary {
  duration: string;
  segments: FlightSegment[];
}

export interface FlightOffer {
  id: string;
  itineraries: FlightItinerary[];
  price: { total: string; currency: string; grandTotal: string };
  numberOfBookableSeats?: number;
}

export interface FlightSearchResult {
  flights: FlightOffer[];
  message?: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: string;
}

export interface FlightSearchHistoryEntry {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  passengers: number;
  cabinClass: string;
  createdAt: string;
}

export interface FlightTracking {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  priceThreshold: number | null;
  currency: string;
  lastPrice: number | null;
  lastCheckedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTrackingParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  priceThreshold?: number;
  currency?: string;
}

class FlightService {
  async searchFlights(
    params: FlightSearchParams
  ): Promise<FlightSearchResult> {
    const query = new URLSearchParams();
    query.set('origin', params.origin);
    query.set('destination', params.destination);
    query.set('departDate', params.departDate);
    if (params.returnDate) {
      query.set('returnDate', params.returnDate);
    }
    if (params.passengers) {
      query.set('passengers', String(params.passengers));
    }
    if (params.cabinClass) {
      query.set('cabinClass', params.cabinClass);
    }

    const response = await api.get<
      ApiResponse<FlightSearchResult>
    >(`/flights/search?${query.toString()}`);

    return response.data.data;
  }

  async getSearchHistory(
    page = 1,
    limit = 20
  ): Promise<{
    searches: FlightSearchHistoryEntry[];
    pagination: PaginatedResponse<unknown>['pagination'];
  }> {
    const response = await api.get<
      PaginatedResponse<FlightSearchHistoryEntry[]>
    >(`/flights/search/history?page=${page}&limit=${limit}`);

    return {
      searches: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async createTracking(
    params: CreateTrackingParams
  ): Promise<FlightTracking> {
    const response = await api.post<
      ApiResponse<{ tracking: FlightTracking }>
    >('/flights/trackings', params);

    return response.data.data.tracking;
  }

  async getTrackings(
    page = 1,
    limit = 20
  ): Promise<{
    trackings: FlightTracking[];
    pagination: PaginatedResponse<unknown>['pagination'];
  }> {
    const response = await api.get<
      PaginatedResponse<FlightTracking[]>
    >(`/flights/trackings?page=${page}&limit=${limit}`);

    return {
      trackings: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async deleteTracking(id: string): Promise<void> {
    await api.delete(`/flights/trackings/${id}`);
  }

  async deactivateTracking(id: string): Promise<void> {
    await api.patch(`/flights/trackings/${id}/deactivate`);
  }
}

const flightService = new FlightService();
export default flightService;
