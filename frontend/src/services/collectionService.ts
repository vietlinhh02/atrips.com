import api from '@/src/lib/api';

export interface CachedPlace {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  photos: unknown;
}

export interface SavedPlace {
  id: string;
  placeId: string;
  notes: string | null;
  savedAt: string;
  cached_places: CachedPlace;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { saved_places: number };
  saved_places?: SavedPlace[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

interface SuccessResponse<T> {
  success: boolean;
  data: T;
}

class CollectionService {
  async listCollections(
    params?: { page?: number; limit?: number }
  ): Promise<{ collections: Collection[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<Collection>>(
      '/collections',
      { params }
    );
    return {
      collections: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async listPublicCollections(
    params?: { page?: number; limit?: number }
  ): Promise<{ collections: Collection[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<Collection>>(
      '/collections/public',
      { params }
    );
    return {
      collections: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async listSavedPlaces(
    params?: { page?: number; limit?: number }
  ): Promise<{ savedPlaces: SavedPlace[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<SavedPlace>>(
      '/collections/saved-places',
      { params }
    );
    return {
      savedPlaces: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async getCollection(id: string): Promise<Collection> {
    const response = await api.get<
      SuccessResponse<{ collection: Collection }>
    >(`/collections/${id}`);
    return response.data.data.collection;
  }

  async createCollection(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Collection> {
    const response = await api.post<
      SuccessResponse<{ collection: Collection }>
    >('/collections', data);
    return response.data.data.collection;
  }

  async updateCollection(
    id: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
    }
  ): Promise<Collection> {
    const response = await api.patch<
      SuccessResponse<{ collection: Collection }>
    >(`/collections/${id}`, data);
    return response.data.data.collection;
  }

  async deleteCollection(id: string): Promise<void> {
    await api.delete(`/collections/${id}`);
  }

  async addPlace(
    collectionId: string,
    placeId: string,
    notes?: string
  ): Promise<SavedPlace> {
    const response = await api.post<
      SuccessResponse<{ savedPlace: SavedPlace }>
    >(`/collections/${collectionId}/places`, { placeId, notes });
    return response.data.data.savedPlace;
  }

  async removePlace(
    collectionId: string,
    placeId: string
  ): Promise<void> {
    await api.delete(
      `/collections/${collectionId}/places/${placeId}`
    );
  }
}

export const collectionService = new CollectionService();
export default collectionService;
