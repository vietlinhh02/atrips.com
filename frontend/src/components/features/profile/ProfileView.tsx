'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  MapPin,
  SealCheck,
  Plus,
  DotsThree,
  Heart,
  GearSix,
  Camera,
  SpinnerGap,
  ArrowsVertical,
  Check,
  X,
} from '@phosphor-icons/react';
import { Badge } from '@/src/components/ui/badge';
import type { PublicTrip } from '@/src/services/publicProfileService';
import uploadService from '@/src/services/uploadService';
import userService from '@/src/services/userService';
import followService from '@/src/services/followService';
import useAuthStore from '@/src/stores/authStore';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';

const TIER_STYLES: Record<string, string> = {
  FREE: 'bg-[var(--neutral-30)] text-[var(--neutral-70)]',
  PRO: 'bg-blue-100 text-blue-700',
  BUSINESS: 'bg-amber-100 text-amber-700',
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge
      variant="secondary"
      className={`${TIER_STYLES[tier] ?? TIER_STYLES.FREE} text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5`}
    >
      {tier}
    </Badge>
  );
}

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (
      parts[0]![0]! + parts[parts.length - 1]![0]!
    ).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function deriveUsername(
  displayName?: string | null,
  email?: string | null
): string {
  if (displayName) {
    return displayName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9_]/g, '');
  }
  if (email) {
    return email.split('@')[0] ?? 'user';
  }
  return 'user';
}

export interface ProfileViewProps {
  userId: string;
  displayName: string;
  name?: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  coverImageOffsetY?: number;
  bio: string | null;
  location: string | null;
  tier: string;
  createdAt: string;
  tripsCount: number;
  travelerTypes: string[];
  personaTitle: string | null;
  trips: PublicTrip[];
  isOwnProfile: boolean;
  email?: string | null;
  followersCount?: number;
  followingCount?: number;
}

type TabKey = 'guides' | 'collections';

export default function ProfileView({
  userId,
  displayName,
  name,
  avatarUrl: initialAvatarUrl,
  coverImageUrl: initialCoverImageUrl,
  coverImageOffsetY: initialOffsetY = 50,
  bio,
  location,
  tier,
  tripsCount,
  travelerTypes,
  personaTitle,
  trips,
  isOwnProfile,
  email,
  followersCount: initialFollowersCount = 0,
  followingCount = 0,
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('guides');
  const currentUser = useAuthStore((s) => s.user);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    if (isOwnProfile || !currentUser) return;
    followService.getFollowStatus(userId).then((status) => {
      setIsFollowing(status.isFollowing);
      setFollowersCount(status.followersCount);
    }).catch(() => {});
  }, [userId, isOwnProfile, currentUser]);

  const handleFollowToggle = useCallback(async () => {
    if (!currentUser || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollow(userId);
        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await followService.follow(userId);
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    } catch {
      // Revert on error by re-fetching
      try {
        const status = await followService.getFollowStatus(userId);
        setIsFollowing(status.isFollowing);
        setFollowersCount(status.followersCount);
      } catch {}
    } finally {
      setIsFollowLoading(false);
    }
  }, [userId, isFollowing, isFollowLoading, currentUser]);

  // Cover image state
  const [coverImageUrl, setCoverImageUrl] = useState(
    initialCoverImageUrl
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Cover reposition state
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  const [savedOffsetY, setSavedOffsetY] = useState(initialOffsetY);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, offset: 0 });
  const coverContainerRef = useRef<HTMLDivElement>(null);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fullName =
    name && name.length > displayName.length ? name : displayName;
  const username = deriveUsername(fullName, email);

  // --- Cover handlers ---
  const handleCoverClick = useCallback(() => {
    if (isOwnProfile && !isUploadingCover && !isRepositioning) {
      coverInputRef.current?.click();
    }
  }, [isOwnProfile, isUploadingCover, isRepositioning]);

  const handleCoverFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingCover(true);
      try {
        const url = await uploadService.uploadCoverImage(file);
        await userService.updateProfile({
          coverImageUrl: url,
          coverImageOffsetY: 50,
        });
        setCoverImageUrl(url);
        setOffsetY(50);
        setSavedOffsetY(50);
        setIsRepositioning(true);
      } catch (err) {
        console.error(
          'Cover upload failed:',
          err instanceof Error ? err.message : err
        );
      } finally {
        setIsUploadingCover(false);
        if (coverInputRef.current) {
          coverInputRef.current.value = '';
        }
      }
    },
    []
  );

  const handleRepositionStart = useCallback(() => {
    setSavedOffsetY(offsetY);
    setIsRepositioning(true);
  }, [offsetY]);

  const handleRepositionSave = useCallback(async () => {
    setIsSavingPosition(true);
    try {
      await userService.updateProfile({ coverImageOffsetY: offsetY });
      setSavedOffsetY(offsetY);
      setIsRepositioning(false);
    } catch (err) {
      console.error(
        'Failed to save position:',
        err instanceof Error ? err.message : err
      );
    } finally {
      setIsSavingPosition(false);
    }
  }, [offsetY]);

  const handleRepositionCancel = useCallback(() => {
    setOffsetY(savedOffsetY);
    setIsRepositioning(false);
  }, [savedOffsetY]);

  // Drag handlers
  const handleDragStart = useCallback(
    (clientY: number) => {
      if (!isRepositioning) return;
      isDraggingRef.current = true;
      dragStartRef.current = { y: clientY, offset: offsetY };
    },
    [isRepositioning, offsetY]
  );

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current || !coverContainerRef.current) return;
    const containerHeight = coverContainerRef.current.clientHeight;
    const deltaY = clientY - dragStartRef.current.y;
    const sensitivity = 100 / containerHeight;
    const newOffset = Math.min(
      100,
      Math.max(0, dragStartRef.current.offset - deltaY * sensitivity)
    );
    setOffsetY(Math.round(newOffset));
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!isRepositioning) return;

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, {
      passive: false,
    });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isRepositioning, handleDragMove, handleDragEnd]);

  // --- Avatar handlers ---
  const handleAvatarClick = useCallback(() => {
    if (isOwnProfile && !isUploadingAvatar) {
      avatarInputRef.current?.click();
    }
  }, [isOwnProfile, isUploadingAvatar]);

  const handleAvatarFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingAvatar(true);
      try {
        const url = await uploadService.uploadAvatar(file);
        await userService.updateProfile({ avatarUrl: url });
        setAvatarUrl(url);
      } catch (err) {
        console.error(
          'Avatar upload failed:',
          err instanceof Error ? err.message : err
        );
      } finally {
        setIsUploadingAvatar(false);
        if (avatarInputRef.current) {
          avatarInputRef.current.value = '';
        }
      }
    },
    []
  );

  return (
    <div className="w-full pb-8">
      {/* Cover Photo */}
      <div
        ref={coverContainerRef}
        className={`relative h-56 sm:h-64 overflow-hidden group${
          isRepositioning
            ? ' cursor-grab active:cursor-grabbing'
            : isOwnProfile
              ? ' cursor-pointer'
              : ''
        }`}
        style={
          coverImageUrl
            ? undefined
            : {
                background:
                  'linear-gradient(to right, #073e71, #0a5a8a, #0d7377)',
              }
        }
        onClick={!isRepositioning ? handleCoverClick : undefined}
        onMouseDown={
          isRepositioning
            ? (e) => {
                e.preventDefault();
                handleDragStart(e.clientY);
              }
            : undefined
        }
        onTouchStart={
          isRepositioning
            ? (e) => {
                if (e.touches[0]) {
                  handleDragStart(e.touches[0].clientY);
                }
              }
            : undefined
        }
        role={isOwnProfile && !isRepositioning ? 'button' : undefined}
        tabIndex={isOwnProfile && !isRepositioning ? 0 : undefined}
        onKeyDown={
          isOwnProfile && !isRepositioning
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCoverClick();
                }
              }
            : undefined
        }
        aria-label={
          isRepositioning
            ? 'Drag to reposition cover image'
            : isOwnProfile
              ? 'Change cover image'
              : undefined
        }
      >
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt="Profile cover"
            fill
            className="object-cover select-none"
            style={{ objectPosition: `center ${offsetY}%` }}
            unoptimized
            priority
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIi8+PC9zdmc+')]" />
        )}

        {/* Reposition mode overlay */}
        {isRepositioning && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-white">
              <ArrowsVertical size={16} />
              Drag to reposition
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRepositionCancel();
                }}
                className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/30"
              >
                <X size={14} weight="bold" />
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRepositionSave();
                }}
                disabled={isSavingPosition}
                className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-[var(--neutral-100)] transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {isSavingPosition ? (
                  <SpinnerGap
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={14} weight="bold" />
                )}
                Save
              </button>
            </div>
          </div>
        )}

        {/* Hover overlay (not during reposition or upload) */}
        {isOwnProfile && !isRepositioning && !isUploadingCover && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white">
                <Camera size={18} weight="fill" />
                Change Cover
              </div>
              {coverImageUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRepositionStart();
                  }}
                  className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/80"
                >
                  <ArrowsVertical size={18} />
                  Adjust
                </button>
              )}
            </div>
          </div>
        )}

        {isUploadingCover && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white">
              <SpinnerGap
                size={18}
                className="animate-spin"
              />
              Uploading...
            </div>
          </div>
        )}

        {isOwnProfile && (
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFileChange}
          />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Avatar row — only avatar overlaps cover */}
        <div className="relative -mt-[68px] mb-4 flex items-end justify-between">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`relative h-36 w-36 shrink-0 overflow-hidden rounded-full bg-[var(--neutral-10)] ring-4 ring-[var(--neutral-10)] shadow-lg${
              isOwnProfile ? ' group/avatar cursor-pointer' : ''
            }`}
            onClick={handleAvatarClick}
            role={isOwnProfile ? 'button' : undefined}
            tabIndex={isOwnProfile ? 0 : undefined}
            onKeyDown={
              isOwnProfile
                ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAvatarClick();
                    }
                  }
                : undefined
            }
            aria-label={isOwnProfile ? 'Change avatar' : undefined}
          >
            <Image
              src={
                avatarUrl ||
                getDefaultAvatarUrl(email, displayName)
              }
              alt={displayName}
              fill
              className="object-cover"
              unoptimized
            />
            {isOwnProfile && !isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/avatar:bg-black/40">
                <Camera
                  size={24}
                  weight="fill"
                  className="text-white opacity-0 transition-opacity group-hover/avatar:opacity-100"
                />
              </div>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <SpinnerGap
                  size={24}
                  className="animate-spin text-white"
                />
              </div>
            )}
          </motion.div>

          {isOwnProfile && (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          )}

          {/* Action Buttons — aligned right at cover bottom */}
          <div className="flex items-center gap-2 pb-1 shrink-0">
            {isOwnProfile ? (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--neutral-40)] bg-[var(--neutral-10)] px-4 py-2 text-sm font-medium text-[var(--neutral-100)] transition-colors hover:bg-[var(--neutral-20)]"
              >
                <GearSix size={16} />
                Edit Profile
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {}}
                  className="flex items-center justify-center rounded-lg border border-[var(--neutral-30)] bg-white p-2.5 text-[var(--neutral-70)] shadow-sm transition-colors hover:bg-[var(--neutral-20)]"
                  aria-label="More options"
                >
                  <DotsThree size={20} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => {}}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--neutral-30)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--neutral-100)] shadow-sm transition-colors hover:bg-[var(--neutral-20)]"
                >
                  Hire Me
                </button>
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={isFollowLoading}
                  className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                    isFollowing
                      ? 'border border-[var(--neutral-30)] bg-white text-[var(--neutral-100)] hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      : 'bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]'
                  } disabled:opacity-50`}
                >
                  {isFollowLoading ? (
                    <SpinnerGap size={16} className="animate-spin" />
                  ) : isFollowing ? (
                    <Check size={16} weight="bold" />
                  ) : (
                    <Plus size={16} weight="bold" />
                  )}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Name & Meta — fully below cover on white bg */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-2xl font-semibold text-[var(--neutral-100)]">
              {fullName}
            </h1>
            <SealCheck
              size={22}
              weight="fill"
              className="text-blue-500 shrink-0"
            />
            <TierBadge tier={tier} />
          </div>

          <p className="text-sm text-[var(--neutral-60)] mb-1">
            @{username}
          </p>

          {personaTitle && (
            <p className="text-sm text-[var(--neutral-70)] mb-1">
              {personaTitle}
            </p>
          )}

          {bio && (
            <p className="text-sm text-[var(--neutral-80)] mb-2 max-w-2xl line-clamp-3">
              {bio}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--neutral-60)]">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin
                  size={14}
                  weight="fill"
                  className="text-[var(--neutral-50)]"
                />
                {location}
              </span>
            )}
            <span>
              <span className="font-semibold text-[var(--neutral-100)]">
                {tripsCount}
              </span>{' '}
              Guides
            </span>
            <span>
              <span className="font-semibold text-[var(--neutral-100)]">
                {followersCount}
              </span>{' '}
              Followers
            </span>
            <span>
              <span className="font-semibold text-[var(--neutral-100)]">
                {followingCount}
              </span>{' '}
              Following
            </span>
          </div>
        </div>

        {/* Traveler Types */}
        {travelerTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {travelerTypes.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-surface)] px-3 py-1.5 text-xs font-medium text-[var(--primary-main)]"
              >
                <Heart size={12} weight="fill" />
                {type
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        <div className="border-b border-[var(--neutral-30)] mb-6">
          <nav
            className="flex gap-6"
            aria-label="Profile tabs"
          >
            <button
              type="button"
              onClick={() => setActiveTab('guides')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === 'guides'
                  ? 'text-[var(--neutral-100)]'
                  : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                Guides
                <span className="inline-flex items-center justify-center rounded-full bg-[var(--neutral-20)] px-2 py-0.5 text-[11px] font-semibold text-[var(--neutral-70)]">
                  {tripsCount}
                </span>
              </span>
              {activeTab === 'guides' && (
                <motion.div
                  layoutId="profile-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--neutral-100)]"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collections')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === 'collections'
                  ? 'text-[var(--neutral-100)]'
                  : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)]'
              }`}
            >
              Collections
              {activeTab === 'collections' && (
                <motion.div
                  layoutId="profile-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--neutral-100)]"
                />
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'guides' && <GuidesGrid trips={trips} />}
        {activeTab === 'collections' && <CollectionsPlaceholder />}
      </div>
    </div>
  );
}

function GuidesGrid({ trips }: { trips: PublicTrip[] }) {
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[10px] bg-[var(--neutral-20)] px-6 py-16 text-center">
        <MapPin
          size={32}
          weight="duotone"
          className="text-[var(--neutral-50)]"
        />
        <p className="text-sm text-[var(--neutral-60)]">
          No guides yet
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {trips.map((trip, index) => (
        <TripCard key={trip.id} trip={trip} index={index} />
      ))}
    </div>
  );
}

function TripCard({
  trip,
  index,
}: {
  trip: PublicTrip;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      <Link
        href={`/trips/${trip.id}`}
        className="group block overflow-hidden rounded-[10px] shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md"
      >
        <div className="relative h-56 bg-[var(--neutral-20)] overflow-hidden rounded-[10px]">
          {trip.coverImageUrl ? (
            <Image
              src={trip.coverImageUrl}
              alt={trip.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary-surface)] to-[var(--neutral-20)]">
              <MapPin
                size={32}
                weight="duotone"
                className="text-[var(--neutral-40)]"
              />
            </div>
          )}
        </div>
        <div className="pt-3 pb-1">
          <h4 className="text-lg font-medium text-[var(--neutral-100)] truncate group-hover:text-[var(--primary-main)] transition-colors">
            {trip.title}
          </h4>
          {trip.description && (
            <p className="flex items-center gap-1 text-sm text-[var(--neutral-60)] mt-1 truncate">
              <MapPin size={14} className="shrink-0" />
              {trip.description}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function CollectionsPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[10px] bg-[var(--neutral-20)] px-6 py-16 text-center">
      <MapPin
        size={32}
        weight="duotone"
        className="text-[var(--neutral-50)]"
      />
      <p className="text-sm text-[var(--neutral-60)]">
        No collections yet
      </p>
    </div>
  );
}
