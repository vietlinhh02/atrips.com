'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Trophy,
  Flag,
  Star,
  Camera,
  Users,
  Sun,
  Medal,
  Lock,
  Crown,
  Lightning,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/src/components/ui/avatar';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/src/components/ui/tabs';
import { Button } from '@/src/components/ui/button';
import useAuthStore from '@/src/stores/authStore';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';
import gamificationService from '@/src/services/gamificationService';
import type {
  Badge,
  UserBadge,
  PointsEntry,
  LeaderboardEntry,
} from '@/src/services/gamificationService';

const TIER_STYLES: Record<string, {
  bg: string;
  text: string;
  border: string;
  glow: string;
}> = {
  bronze: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-400',
    glow: 'shadow-amber-200/50',
  },
  silver: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-400',
    glow: 'shadow-gray-200/50',
  },
  gold: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-400',
    glow: 'shadow-yellow-200/50',
  },
};

const ACTION_ICONS: Record<string, Icon> = {
  TRIP_CREATED: Trophy,
  TRIP_COMPLETED: Flag,
  REVIEW_POSTED: Star,
  PHOTO_UPLOADED: Camera,
  REFERRAL: Users,
  DAILY_LOGIN: Sun,
  BADGE_EARNED: Medal,
};

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600',
};

const listItem = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
};

function BadgeCard({
  badge,
  earned,
  earnedAt,
  index,
}: {
  badge: Badge;
  earned: boolean;
  earnedAt: string | null;
  index: number;
}) {
  const tier = badge.tier.toLowerCase();
  const style = TIER_STYLES[tier] ?? TIER_STYLES.bronze!;

  return (
    <motion.div
      custom={index}
      variants={listItem}
      initial="hidden"
      animate="visible"
      className={`
        relative rounded-xl border-2 p-4 transition-all
        ${earned
          ? `${style.border} bg-white shadow-lg ${style.glow}`
          : 'border-[var(--neutral-30)] bg-[var(--neutral-10)] opacity-60'
        }
      `}
    >
      {!earned && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[1px]">
          <Lock
            size={28}
            weight="fill"
            className="text-neutral-400"
          />
        </div>
      )}

      <div className="flex flex-col items-center text-center gap-2">
        <div className={`
          flex h-14 w-14 items-center justify-center rounded-full
          ${earned ? style.bg : 'bg-neutral-100'}
        `}>
          {badge.iconUrl ? (
            <img
              src={badge.iconUrl}
              alt={badge.name}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <Medal
              size={28}
              weight="fill"
              className={earned ? style.text : 'text-neutral-400'}
            />
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1">
          {badge.name}
        </h3>

        <p className="text-xs text-neutral-500 line-clamp-2 min-h-[2rem]">
          {badge.description}
        </p>

        <div className="flex items-center gap-2">
          <span className={`
            inline-flex items-center rounded-full px-2 py-0.5
            text-[10px] font-semibold uppercase
            ${style.bg} ${style.text}
          `}>
            {badge.tier}
          </span>
          <span className="text-xs font-medium text-neutral-600">
            {badge.points} pts
          </span>
        </div>

        {earned && earnedAt && (
          <p className="text-[10px] text-neutral-400 mt-1">
            Earned {format(new Date(earnedAt), 'MMM d, yyyy')}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function BadgesTab() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [allBadges, myBadges] = await Promise.all([
          gamificationService.getAllBadges(),
          gamificationService.getMyBadges(),
        ]);
        setBadges(allBadges);
        setUserBadges(myBadges);
      } catch (err) {
        console.error('Failed to load badges:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-52 rounded-xl bg-[var(--neutral-20)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const earnedMap = new Map(
    userBadges.map((ub) => [ub.badgeId, ub.earnedAt])
  );

  const sorted = [...badges].sort((a, b) => {
    const aEarned = earnedMap.has(a.id);
    const bEarned = earnedMap.has(b.id);
    if (aEarned !== bEarned) return aEarned ? -1 : 1;
    return 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Medal size={48} className="text-neutral-300 mb-3" />
        <p className="text-neutral-500">
          No badges available yet. Keep exploring!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
      {sorted.map((badge, i) => (
        <BadgeCard
          key={badge.id}
          badge={badge}
          earned={earnedMap.has(badge.id)}
          earnedAt={earnedMap.get(badge.id) ?? null}
          index={i}
        />
      ))}
    </div>
  );
}

function PointsTab() {
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [entries, setEntries] = useState<PointsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [points, history] = await Promise.all([
          gamificationService.getMyPoints(),
          gamificationService.getPointsHistory({ page: 1, limit: 20 }),
        ]);
        setTotalPoints(points);
        setEntries(history.entries);
        setHasMore(history.pagination.hasMore);
      } catch (err) {
        console.error('Failed to load points:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const history = await gamificationService.getPointsHistory({
        page: nextPage,
        limit: 20,
      });
      setEntries((prev) => [...prev, ...history.entries]);
      setHasMore(history.pagination.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more points:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-24 rounded-xl bg-[var(--neutral-20)] animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-[var(--neutral-20)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-[#073e71] to-[#0a5a8a] p-6 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <Lightning size={32} weight="fill" className="text-yellow-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/80">Total Points</p>
          <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lightning size={48} className="text-neutral-300 mb-3" />
          <p className="text-neutral-500">
            No points earned yet. Start your journey!
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-neutral-500 uppercase">
            Points History
          </h3>
          <div className="space-y-2">
            <AnimatePresence>
              {entries.map((entry, i) => {
                const ActionIcon =
                  ACTION_ICONS[entry.action] ?? Lightning;
                return (
                  <motion.div
                    key={entry.id}
                    custom={i}
                    variants={listItem}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="flex items-center gap-4 rounded-lg border border-[var(--neutral-30)] bg-white p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2f8fd]">
                      <ActionIcon
                        size={20}
                        weight="fill"
                        className="text-[#073e71]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {entry.description ?? entry.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                      +{entry.points}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardTab() {
  const user = useAuthStore((state) => state.user);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await gamificationService.getLeaderboard({
          page: 1,
          limit: 20,
        });
        setEntries(data);
        setHasMore(data.length === 20);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await gamificationService.getLeaderboard({
        page: nextPage,
        limit: 20,
      });
      setEntries((prev) => [...prev, ...data]);
      setHasMore(data.length === 20);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more leaderboard:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-[var(--neutral-20)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Crown size={48} className="text-neutral-300 mb-3" />
        <p className="text-neutral-500">
          The leaderboard is empty. Be the first!
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      <AnimatePresence>
        {entries.map((entry, i) => {
          const isCurrentUser = user?.id === entry.userId;
          const isTop3 = entry.rank <= 3;
          const rankColor = RANK_COLORS[entry.rank] ?? '';
          const displayName =
            entry.user?.displayName ?? entry.user?.name ?? 'Traveler';

          return (
            <motion.div
              key={entry.id}
              custom={i}
              variants={listItem}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className={`
                flex items-center gap-4 rounded-lg border p-4 transition-colors
                ${isCurrentUser
                  ? 'border-[#073e71] bg-[#f2f8fd]'
                  : 'border-[var(--neutral-30)] bg-white'
                }
              `}
            >
              <div className={`
                flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                font-bold text-sm
                ${isTop3 ? 'bg-gradient-to-br from-yellow-100 to-amber-50' : 'bg-neutral-100'}
              `}>
                {isTop3 ? (
                  <Crown
                    size={20}
                    weight="fill"
                    className={rankColor}
                  />
                ) : (
                  <span className="text-neutral-600">{entry.rank}</span>
                )}
              </div>

              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage
                  src={
                    entry.user?.avatarUrl ??
                    getDefaultAvatarUrl(undefined, displayName)
                  }
                  alt={displayName}
                />
                <AvatarFallback>
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className={`
                  text-sm font-medium truncate
                  ${isCurrentUser ? 'text-[#073e71]' : 'text-neutral-900'}
                `}>
                  {displayName}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs font-normal text-[#073e71]/70">
                      (You)
                    </span>
                  )}
                </p>
              </div>

              <span className="text-sm font-bold text-neutral-700 whitespace-nowrap">
                {entry.totalPoints.toLocaleString()} pts
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

function AchievementsContent() {
  return (
    <Tabs defaultValue="badges" className="w-full max-w-[1320px] mx-auto px-4 md:px-6">
      <div className="sticky top-0 z-10 bg-[var(--neutral-10)] border-b border-[var(--neutral-30)] py-4">
        <TabsList className="bg-[var(--neutral-20)] h-10 p-1 gap-1 rounded-lg">
          <TabsTrigger
            value="badges"
            className="data-[state=active]:bg-white data-[state=active]:text-[#073e71] data-[state=active]:shadow-sm rounded-md px-4 gap-1.5"
          >
            <Medal size={16} weight="bold" />
            Badges
          </TabsTrigger>
          <TabsTrigger
            value="points"
            className="data-[state=active]:bg-white data-[state=active]:text-[#073e71] data-[state=active]:shadow-sm rounded-md px-4 gap-1.5"
          >
            <Lightning size={16} weight="bold" />
            Points
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="data-[state=active]:bg-white data-[state=active]:text-[#073e71] data-[state=active]:shadow-sm rounded-md px-4 gap-1.5"
          >
            <Crown size={16} weight="bold" />
            Leaderboard
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="pb-8">
        <TabsContent value="badges" className="mt-0">
          <BadgesTab />
        </TabsContent>
        <TabsContent value="points" className="mt-0">
          <PointsTab />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-0">
          <LeaderboardTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default function AchievementsPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <AchievementsContent />
    </>
  );
}
