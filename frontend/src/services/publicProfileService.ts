import api from '@/src/lib/api';

export interface PublicProfileUser {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  coverImageOffsetY: number;
  bio: string | null;
  createdAt: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS';
  location: string | null;
  travelerTypes: string[];
  personaTitle: string | null;
  tripsCount: number;
  followersCount: number;
  followingCount: number;
}

export interface PublicTrip {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  status: string;
}

export interface PublicProfileData {
  user: PublicProfileUser;
  trips: PublicTrip[];
}

const publicProfileService = {
  async getPublicProfile(
    userId: string
  ): Promise<PublicProfileData> {
    const response = await api.get(
      `/users/${userId}/public`
    );
    return response.data.data;
  },
};

export default publicProfileService;
