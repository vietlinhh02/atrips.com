import api from '@/src/lib/api';

export interface FollowStatus {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

const followService = {
  async follow(userId: string): Promise<void> {
    await api.post(`/users/${userId}/follow`);
  },

  async unfollow(userId: string): Promise<void> {
    await api.delete(`/users/${userId}/follow`);
  },

  async getFollowStatus(userId: string): Promise<FollowStatus> {
    const res = await api.get(`/users/${userId}/follow-status`);
    return res.data.data;
  },
};

export default followService;
