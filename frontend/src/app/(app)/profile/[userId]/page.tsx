'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ProfileView from '@/src/components/features/profile/ProfileView';
import ProfileSkeleton from '@/src/components/features/profile/ProfileSkeleton';
import useAuthStore from '@/src/stores/authStore';
import publicProfileService from '@/src/services/publicProfileService';
import type { PublicProfileData } from '@/src/services/publicProfileService';

function PublicProfileContent() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const currentUser = useAuthStore((s) => s.user);

  const [data, setData] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result =
        await publicProfileService.getPublicProfile(userId);
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-lg font-medium text-[var(--neutral-100)] mb-2">
          Profile not found
        </p>
        <p className="text-sm text-[var(--neutral-60)]">
          {error ||
            'This user does not exist or their profile is private.'}
        </p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === data.user.id;

  return (
    <ProfileView
      userId={data.user.id}
      displayName={data.user.name}
      name={data.user.name}
      avatarUrl={data.user.avatarUrl}
      coverImageUrl={data.user.coverImageUrl}
      coverImageOffsetY={data.user.coverImageOffsetY}
      bio={data.user.bio}
      location={data.user.location}
      tier={data.user.tier}
      createdAt={data.user.createdAt}
      tripsCount={data.user.tripsCount}
      travelerTypes={data.user.travelerTypes}
      personaTitle={data.user.personaTitle}
      trips={data.trips}
      isOwnProfile={isOwnProfile}
      followersCount={data.user.followersCount}
      followingCount={data.user.followingCount}
    />
  );
}

export default function PublicProfilePage() {
  return <PublicProfileContent />;
}
