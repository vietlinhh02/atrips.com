import api from '@/src/lib/api';

export interface EnrichedPlace {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  phone: string | null;
  website: string | null;
  photos: string[];
  categories: string[];
  enrichedData: {
    openingHours?: string | null;
    description?: string | null;
    priceRange?: string | null;
    reviewSnippets?: Array<{
      text: string;
      source: string;
      title: string;
    }>;
    amenities?: string[];
  } | null;
}

const placeService = {
  async enrichPlace(placeId: string): Promise<EnrichedPlace> {
    const response = await api.get(`/places/${placeId}/enrich`);
    return response.data.data.place;
  },

  async lookupPlace(name: string): Promise<EnrichedPlace> {
    const params = new URLSearchParams({ name });
    const response = await api.get(`/places/lookup?${params.toString()}`);
    return response.data.data.place;
  },

  async searchPlaces(
    query: string,
    lat?: number,
    lng?: number
  ): Promise<EnrichedPlace[]> {
    const params = new URLSearchParams({ query });
    if (lat != null) params.set('lat', lat.toString());
    if (lng != null) params.set('lng', lng.toString());
    const response = await api.get(
      `/places/search?${params.toString()}`
    );
    return response.data.data.places;
  },
};

export default placeService;
