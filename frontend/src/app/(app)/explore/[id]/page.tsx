'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useChatStore from '@/src/stores/chatStore';
import exploreService from '@/src/services/exploreService';
import DestinationDetail from '@/src/components/features/explore/DestinationDetail';
import type {
  Destination,
  WeatherData,
  DestinationEnrichment,
} from '@/src/services/exploreService';

export default function DestinationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const createConversation = useChatStore(
    (s) => s.createConversation,
  );
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [destination, setDestination] =
    useState<Destination | null>(null);
  const [similar, setSimilar] = useState<Destination[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [enrichment, setEnrichment] =
    useState<DestinationEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await exploreService.getDestination(id);
        setDestination(data.destination);
        setSimilar(data.similarDestinations);
        setWeather(data.weather);
        setEnrichment(data.enrichment);
      } catch {
        setError('Destination not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePlanTrip = useCallback(
    async (dest: Destination) => {
      const place = dest.cached_place;
      const message = `Plan a trip to ${place.city}, ${place.country}`;
      const conversationId = await createConversation(
        undefined,
        message,
      );
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
        setTimeout(() => sendMessage(message), 300);
      }
    },
    [createConversation, sendMessage, router],
  );

  const handleSave = useCallback(
    (dest: Destination) => {
      router.push(
        `/collections?save=${dest.cachedPlaceId}`,
      );
    },
    [router],
  );

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-[1320px] space-y-6">
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--neutral-20)]" />
          <div className="h-96 animate-pulse rounded-2xl bg-[var(--neutral-20)]" />
          <div className="h-24 animate-pulse rounded-xl bg-[var(--neutral-20)]" />
        </div>
      </div>
    );
  }

  if (error || !destination) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-[var(--neutral-60)]">
            {error ?? 'Something went wrong'}
          </p>
          <button
            onClick={() => router.push('/explore')}
            className="mt-4 text-sm text-[var(--primary-main)] hover:underline"
          >
            Back to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1320px]">
        <DestinationDetail
          destination={destination}
          weather={weather}
          enrichment={enrichment}
          similarDestinations={similar}
          onPlanTrip={handlePlanTrip}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
