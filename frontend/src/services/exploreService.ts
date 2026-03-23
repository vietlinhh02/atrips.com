import api from '@/src/lib/api';

export interface DestinationPlace {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  photos: string[];
  categories: string[];
}

export interface Destination {
  id: string;
  cachedPlaceId: string;
  region: string;
  tagline: string | null;
  bestSeasons: string[];
  avgDailyBudget: number | null;
  tags: string[];
  coverImageAssetIds: string[];
  popularityScore: number;
  isActive: boolean;
  cached_place: DestinationPlace;
  score?: number;
}

export interface PaginatedSection {
  items: Destination[];
  total: number;
  hasMore: boolean;
}

export interface ExploreResponse {
  forYou?: PaginatedSection;
  trending: PaginatedSection;
  budgetFriendly?: PaginatedSection;
  popular?: PaginatedSection;
}

export interface Enhancement {
  personalizedTagline: string;
  whyForYou: string;
}

export interface EnhanceResponse {
  enhancements: Record<string, Enhancement>;
}

export interface WeatherCurrent {
  temperature: number;
  weatherCode: number;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherDay[];
}

export interface BudgetBreakdown {
  accommodation: string;
  food: string;
  transport: string;
  activities: string;
}

export interface DestinationEnrichment {
  description: string;
  highlights: string[];
  bestFor: string;
  localTips: string[];
  budgetBreakdown: BudgetBreakdown;
  knownFor: string[];
}

export interface DestinationDetailResponse {
  destination: Destination;
  weather: WeatherData | null;
  enrichment: DestinationEnrichment | null;
  similarDestinations: Destination[];
}

export interface SearchResponse {
  items: Destination[];
  total: number;
  hasMore: boolean;
}

class ExploreService {
  async getExplore(): Promise<ExploreResponse> {
    const { data } = await api.get('/explore');
    return data.data;
  }

  async getSection(
    section: string,
    limit = 8,
    offset = 0,
  ): Promise<PaginatedSection> {
    const { data } = await api.get('/explore', {
      params: { section, limit, offset },
    });
    return data.data;
  }

  async getDestination(id: string): Promise<DestinationDetailResponse> {
    const { data } = await api.get(`/explore/destinations/${id}`);
    return data.data;
  }

  async search(
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<SearchResponse> {
    const { data } = await api.get('/explore/search', {
      params: { q: query, limit, offset },
    });
    return data.data;
  }

  async enhance(
    destinationIds: string[],
  ): Promise<EnhanceResponse> {
    const { data } = await api.post('/explore/enhance', {
      destinationIds,
    });
    return data.data;
  }
}

const exploreService = new ExploreService();
export default exploreService;
