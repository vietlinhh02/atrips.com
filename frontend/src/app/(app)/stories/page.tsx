'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenNib,
  MagnifyingGlass,
  Plus,
  Eye,
  Heart,
  ChatCircle,
  Compass,
  NotePencil,
  Globe,
} from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/src/components/ui/avatar';
import storyService from '@/src/services/storyService';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';
import type { Story, Pagination } from '@/src/services/storyService';

type Tab = 'discover' | 'my';

const COVER_GRADIENTS = [
  'from-[#073e71] to-[#0a5a8a]',
  'from-[#1a4731] to-[#2d6b4e]',
  'from-[#4a1942] to-[#7b2d6e]',
  'from-[#6b3a2a] to-[#a85d3f]',
  'from-[#2a3a6b] to-[#4a5fa8]',
];

function getGradient(id: string): string {
  let hash = 0;
  for (const ch of id) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  }
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length]!;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden animate-pulse">
      <div className="h-44 bg-[var(--neutral-30)]" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-[var(--neutral-30)] rounded w-3/4" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-full" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-1/2" />
        <div className="flex gap-4 pt-2">
          <div className="h-4 bg-[var(--neutral-20)] rounded w-12" />
          <div className="h-4 bg-[var(--neutral-20)] rounded w-12" />
          <div className="h-4 bg-[var(--neutral-20)] rounded w-12" />
        </div>
      </div>
    </div>
  );
}

interface StoryCardProps {
  story: Story;
  index: number;
  showStatus?: boolean;
}

function StoryCard({ story, index, showStatus }: StoryCardProps) {
  const router = useRouter();
  const hasCover = Boolean(story.coverImage);
  const gradient = getGradient(story.id);

  const commentCount = story._count?.story_comments ?? 0;
  const likeCount = story._count?.story_likes ?? story.likesCount;
  const timeAgo = story.publishedAt
    ? formatDistanceToNow(new Date(story.publishedAt), { addSuffix: true })
    : formatDistanceToNow(new Date(story.createdAt), { addSuffix: true });

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => router.push(`/stories/${story.slug}`)}
      className="group text-left rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden
        hover:shadow-lg hover:border-[var(--primary-outer-border)] transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
    >
      <div className="relative h-44 overflow-hidden">
        {hasCover ? (
          <Image
            src={story.coverImage!}
            alt={story.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <PenNib size={48} weight="thin" className="text-white/30" />
          </div>
        )}

        {showStatus && (
          <div className="absolute top-3 right-3">
            <Badge
              className={`text-[11px] font-semibold px-2 py-0.5 shadow-sm ${
                story.status === 'PUBLISHED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : story.status === 'DRAFT'
                    ? 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {story.status}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2.5">
        <h3 className="text-[15px] font-semibold text-[var(--neutral-100)] line-clamp-1 group-hover:text-[var(--primary-main)] transition-colors">
          {story.title}
        </h3>

        {story.excerpt && (
          <p className="text-xs text-[var(--neutral-60)] line-clamp-2">
            {story.excerpt}
          </p>
        )}

        {story.User && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage
                src={
                  story.User.avatarUrl ??
                  getDefaultAvatarUrl(undefined, story.User.name)
                }
                alt={story.User.displayName || story.User.name}
              />
              <AvatarFallback className="text-[9px]">
                {(story.User.displayName || story.User.name).charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--neutral-70)] truncate">
              {story.User.displayName || story.User.name}
            </span>
            <span className="text-[var(--neutral-30)]">·</span>
            <span className="text-xs text-[var(--neutral-50)]">{timeAgo}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pt-1 text-xs text-[var(--neutral-50)]">
          <span className="flex items-center gap-1">
            <Eye size={14} /> {story.viewsCount}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={14} /> {likeCount}
          </span>
          <span className="flex items-center gap-1">
            <ChatCircle size={14} /> {commentCount}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function EmptyState({ tab, onWrite }: { tab: Tab; onWrite: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center pt-12 pb-20 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-[var(--primary-surface)] flex items-center justify-center mb-6">
        <PenNib size={36} weight="duotone" className="text-[var(--primary-main)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-2">
        {tab === 'discover' ? 'No stories yet' : 'You haven\'t written any stories'}
      </h3>
      <p className="text-sm text-[var(--neutral-60)] max-w-xs mb-6">
        {tab === 'discover'
          ? 'Be the first to share your travel story with the community.'
          : 'Share your travel experiences, tips, and adventures.'}
      </p>
      <Button
        onClick={onWrite}
        className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-5 py-2.5 text-sm font-medium"
      >
        <Plus size={16} weight="bold" className="mr-1.5" />
        Write a Story
      </Button>
    </motion.div>
  );
}

function StoriesContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchStories = useCallback(
    async (page = 1, append = false) => {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const result =
          activeTab === 'discover'
            ? await storyService.listPublished({ page, limit: 12 })
            : await storyService.listMyStories({ page, limit: 12 });

        setStories((prev) =>
          append ? [...prev, ...result.stories] : result.stories
        );
        setPagination(result.pagination);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to load stories';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    fetchStories(1, false);
  }, [fetchStories]);

  const filteredStories = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    const q = searchQuery.toLowerCase();
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.excerpt?.toLowerCase().includes(q) ?? false)
    );
  }, [stories, searchQuery]);

  const handleLoadMore = () => {
    if (pagination && pagination.hasMore) {
      fetchStories(pagination.page + 1, true);
    }
  };

  const handleWrite = () => {
    router.push('/stories/create');
  };

  const tabs: { label: string; value: Tab; icon: typeof Compass }[] = [
    { label: 'Discover', value: 'discover', icon: Compass },
    { label: 'My Stories', value: 'my', icon: NotePencil },
  ];

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--neutral-100)]">
            Travel Stories
          </h2>
          {!isLoading && pagination && (
            <p className="text-sm text-[var(--neutral-60)] mt-0.5">
              {pagination.total}{' '}
              {pagination.total === 1 ? 'story' : 'stories'}
            </p>
          )}
        </div>

        <Button
          onClick={handleWrite}
          className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-4 py-2 text-sm font-medium
            shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] w-fit"
        >
          <Plus size={16} weight="bold" className="mr-1.5" />
          Write Story
        </Button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium
                whitespace-nowrap transition-all duration-150
                ${
                  isActive
                    ? 'bg-[var(--primary-surface)] text-[var(--primary-main)] border border-[var(--primary-outer-border)]'
                    : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] border border-transparent'
                }`}
            >
              <tab.icon size={16} weight={isActive ? 'fill' : 'regular'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="relative mb-6">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]"
        />
        <Input
          type="search"
          placeholder="Search stories by title or excerpt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 border-[var(--neutral-30)] text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button
            onClick={() => fetchStories(1, false)}
            variant="outline"
            className="text-sm"
          >
            Try Again
          </Button>
        </div>
      ) : stories.length === 0 ? (
        <EmptyState tab={activeTab} onWrite={handleWrite} />
      ) : filteredStories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <Globe
            size={32}
            weight="duotone"
            className="text-[var(--neutral-40)] mb-3"
          />
          <p className="text-sm text-[var(--neutral-60)]">
            No stories matching &quot;{searchQuery}&quot;
          </p>
        </motion.div>
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredStories.map((story, i) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  index={i}
                  showStatus={activeTab === 'my'}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {pagination?.hasMore && !searchQuery.trim() && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                variant="outline"
                className="text-sm px-6"
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StoriesPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <StoriesContent />
    </>
  );
}
