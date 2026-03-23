'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExploreHero from '@/src/components/features/explore/ExploreHero';
import DestinationSection from '@/src/components/features/explore/DestinationSection';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import useChatStore from '@/src/stores/chatStore';
import exploreService from '@/src/services/exploreService';
import type {
  Destination,
  ExploreResponse,
  Enhancement,
  SearchResponse,
} from '@/src/services/exploreService';

const SEASON_BANNERS: Record<string, string> = {
  spring: 'Spring escapes -- cherry blossoms & fresh beginnings',
  summer: 'Summer adventures -- beaches, festivals & long days',
  autumn: 'Autumn colors -- cozy cities & harvest festivals',
  winter: 'Winter wonders -- snow peaks & warm getaways',
};

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export default function ExplorePage() {
  const router = useRouter();
  const createConversation = useChatStore((s) => s.createConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [exploreData, setExploreData] =
    useState<ExploreResponse | null>(null);
  const [searchResults, setSearchResults] =
    useState<SearchResponse | null>(null);
  const [enhancements, setEnhancements] =
    useState<Record<string, Enhancement>>({});
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const season = getCurrentSeason();
  const banner = SEASON_BANNERS[season];

  useEffect(() => {
    async function load() {
      try {
        const data = await exploreService.getExplore();
        setExploreData(data);

        // AI enhancement async (optional, non-blocking)
        const allIds = [
          ...(data.forYou?.items ?? []),
          ...(data.trending?.items ?? []),
        ]
          .map((d) => d.id)
          .slice(0, 16);

        if (allIds.length > 0) {
          try {
            const enhanced =
              await exploreService.enhance(allIds);
            setEnhancements(enhanced.enhancements);
          } catch {
            // AI enhancement is optional
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      router.push(`/collections?save=${dest.cachedPlaceId}`);
    },
    [router],
  );

  const handleSearch = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const results = await exploreService.search(query);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-[1320px] space-y-8">
          <div className="h-20 animate-pulse rounded-xl bg-[var(--neutral-20)]" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-48 animate-pulse rounded bg-[var(--neutral-20)]" />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-80 animate-pulse rounded-xl bg-[var(--neutral-20)]"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1320px] space-y-8">
      <ExploreHero
        seasonalBanner={banner}
        onSearch={handleSearch}
      />

      {searchResults ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-end justify-between border-b border-[var(--neutral-30)] pb-4">
            <div>
              <h2 className="text-[20px] font-medium text-[var(--neutral-100)]">
                {searchResults.total} results found
              </h2>
            </div>
            <button
              onClick={clearSearch}
              className="text-[14px] font-medium text-[var(--primary-main)] transition-colors hover:text-[var(--primary-hover)]"
            >
              Clear search
            </button>
          </div>
          <div className="flex overflow-x-auto pb-4 gap-6 snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
            {searchResults.items.map((dest, i) => (
              <div key={dest.id} className="min-w-[260px] md:min-w-0 snap-center">
                <ExploreDestinationCard
                  destination={dest}
                  index={i}
                  onPlanTrip={handlePlanTrip}
                  onSave={handleSave}
                />
              </div>
            ))}
          </div>
          {searchResults.items.length === 0 && (
            <p className="py-12 text-center text-[14px] text-[var(--neutral-60)]">
              No destinations found. Try a different search term.
            </p>
          )}
        </div>
      ) : (
        <>
          {exploreData?.forYou && (
            <DestinationSection
              title="For You"
              subtitle="Personalized picks based on your travel profile"
              sectionKey="forYou"
              initialItems={exploreData.forYou.items}
              initialTotal={exploreData.forYou.total}
              initialHasMore={exploreData.forYou.hasMore}
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.trending && (
            <DestinationSection
              title="Trending This Season"
              subtitle={`Popular destinations for ${season}`}
              sectionKey="trending"
              initialItems={exploreData.trending.items}
              initialTotal={exploreData.trending.total}
              initialHasMore={exploreData.trending.hasMore}
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.budgetFriendly && (
            <DestinationSection
              title="Budget-Friendly Picks"
              subtitle="Great destinations under $60/day"
              sectionKey="budgetFriendly"
              initialItems={
                exploreData.budgetFriendly.items
              }
              initialTotal={
                exploreData.budgetFriendly.total
              }
              initialHasMore={
                exploreData.budgetFriendly.hasMore
              }
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.popular && (
            <DestinationSection
              title="Popular Destinations"
              subtitle="Most loved by travelers worldwide"
              sectionKey="popular"
              initialItems={exploreData.popular.items}
              initialTotal={exploreData.popular.total}
              initialHasMore={exploreData.popular.hasMore}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {!exploreData?.forYou && (
            <div className="rounded-[10px] border border-[var(--neutral-30)] bg-white p-6 text-center dark:bg-[var(--neutral-20)]">
              <p className="text-[14px] text-[var(--neutral-60)]">
                Sign in and complete your travel profile to get personalized recommendations.
              </p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
