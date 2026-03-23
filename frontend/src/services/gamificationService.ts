import api from '@/src/lib/api';

export interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  tier: string;
  points: number;
  isActive: boolean;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  context: Record<string, unknown>;
  badges: Badge;
}

export interface PointsEntry {
  id: string;
  action: string;
  points: number;
  description: string | null;
  entityType: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  scope: string;
  period: string;
  userId: string;
  rank: number;
  totalPoints: number;
  user?: {
    name: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface PointsHistoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface BadgesResponse {
  success: boolean;
  data: { badges: Badge[] };
}

interface UserBadgesResponse {
  success: boolean;
  data: { userBadges: UserBadge[] };
}

interface TotalPointsResponse {
  success: boolean;
  data: { totalPoints: number };
}

interface PointsHistoryResponse {
  success: boolean;
  data: PointsEntry[];
  pagination: PointsHistoryPagination;
}

interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
}

class GamificationService {
  async getAllBadges(): Promise<Badge[]> {
    const response = await api.get<BadgesResponse>(
      '/gamification/badges'
    );
    return response.data.data?.badges ?? [];
  }

  async getMyBadges(): Promise<UserBadge[]> {
    const response = await api.get<UserBadgesResponse>(
      '/gamification/my/badges'
    );
    return response.data.data?.userBadges ?? [];
  }

  async getMyPoints(): Promise<number> {
    const response = await api.get<TotalPointsResponse>(
      '/gamification/my/points'
    );
    return response.data.data?.totalPoints ?? 0;
  }

  async getPointsHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    entries: PointsEntry[];
    pagination: PointsHistoryPagination;
  }> {
    const response = await api.get<PointsHistoryResponse>(
      '/gamification/my/points/history',
      { params }
    );
    return {
      entries: response.data.data ?? [],
      pagination: response.data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    };
  }

  async getLeaderboard(params?: {
    scope?: string;
    period?: string;
    page?: number;
    limit?: number;
  }): Promise<LeaderboardEntry[]> {
    const response = await api.get<LeaderboardResponse>(
      '/gamification/leaderboard',
      { params: { scope: 'global', period: 'all_time', ...params } }
    );
    return response.data.data ?? [];
  }
}

const gamificationService = new GamificationService();
export default gamificationService;
