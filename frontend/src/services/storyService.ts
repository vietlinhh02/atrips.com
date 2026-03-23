import api from '../lib/api';

export interface StoryUser {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface StoryTag {
  id: string;
  storyId: string;
  tagId: string;
  tags: { id: string; name: string };
}

export interface StoryComment {
  id: string;
  storyId: string;
  userId: string;
  content: string;
  parentId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  User: StoryUser;
  other_story_comments?: StoryComment[];
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  viewsCount: number;
  likesCount: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  User?: StoryUser;
  _count?: { story_comments: number; story_likes: number };
  story_tags?: StoryTag[];
  story_comments?: StoryComment[];
}

export interface Pagination {
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

export interface CreateStoryPayload {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

export interface UpdateStoryPayload {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

class StoryService {
  async listPublished(params?: {
    page?: number;
    limit?: number;
    tag?: string;
  }): Promise<{ stories: Story[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<Story>>(
      '/stories',
      { params }
    );
    return {
      stories: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async listMyStories(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ stories: Story[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<Story>>(
      '/stories/my',
      { params }
    );
    return {
      stories: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async getBySlug(slug: string): Promise<Story> {
    const response = await api.get<SuccessResponse<{ story: Story }>>(
      `/stories/${slug}`
    );
    return response.data.data.story;
  }

  async create(payload: CreateStoryPayload): Promise<Story> {
    const response = await api.post<SuccessResponse<{ story: Story }>>(
      '/stories',
      payload
    );
    return response.data.data.story;
  }

  async update(id: string, payload: UpdateStoryPayload): Promise<Story> {
    const response = await api.patch<SuccessResponse<{ story: Story }>>(
      `/stories/${id}`,
      payload
    );
    return response.data.data.story;
  }

  async archive(id: string): Promise<void> {
    await api.delete(`/stories/${id}`);
  }

  async toggleLike(
    id: string
  ): Promise<{ liked: boolean }> {
    const response = await api.post<SuccessResponse<{ liked: boolean }>>(
      `/stories/${id}/like`
    );
    return response.data.data;
  }

  async getComments(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ comments: StoryComment[]; pagination: Pagination }> {
    const response = await api.get<PaginatedResponse<StoryComment>>(
      `/stories/${id}/comments`,
      { params }
    );
    return {
      comments: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async addComment(
    id: string,
    payload: { content: string; parentId?: string }
  ): Promise<StoryComment> {
    const response = await api.post<SuccessResponse<{ comment: StoryComment }>>(
      `/stories/${id}/comments`,
      payload
    );
    return response.data.data.comment;
  }
}

const storyService = new StoryService();
export default storyService;
