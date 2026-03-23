'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  BookmarkSimple,
  MapPin,
  Star,
  Trash,
  PencilSimple,
  Globe,
  Lock,
} from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import collectionService from '@/src/services/collectionService';
import type {
  Collection,
  SavedPlace,
} from '@/src/services/collectionService';

function SkeletonPlaceCard() {
  return (
    <div className="rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden animate-pulse">
      <div className="h-40 bg-[var(--neutral-30)]" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-[var(--neutral-30)] rounded w-3/4" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-full" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-1/3" />
      </div>
    </div>
  );
}

function getPhotoUrl(place: SavedPlace['cached_places']): string | null {
  if (!place.photos) return null;
  if (Array.isArray(place.photos) && place.photos.length > 0) {
    const first = place.photos[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      return (
        (first as Record<string, string>).url ??
        (first as Record<string, string>).photo_reference ??
        null
      );
    }
  }
  return null;
}

interface PlaceCardProps {
  savedPlace: SavedPlace;
  index: number;
  onRemove: (savedPlace: SavedPlace) => void;
}

function PlaceCard({ savedPlace, index, onRemove }: PlaceCardProps) {
  const place = savedPlace.cached_places;
  const photoUrl = getPhotoUrl(place);
  const location = [place.city, place.country]
    .filter(Boolean)
    .join(', ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden
        hover:shadow-lg hover:border-[var(--primary-outer-border)] transition-all duration-200"
    >
      <div className="relative h-40 overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#073e71] to-[#0a5a8a] flex items-center justify-center">
            <MapPin size={48} weight="thin" className="text-white/30" />
          </div>
        )}

        {place.type && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-[var(--neutral-10)]/90 backdrop-blur-sm text-[var(--neutral-70)] text-[11px] font-medium px-2 py-0.5 border border-[var(--neutral-30)]">
              {place.type}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-[15px] font-semibold text-[var(--neutral-100)] line-clamp-1">
          {place.name}
        </h3>

        {(place.address || location) && (
          <div className="flex items-start gap-1.5 text-xs text-[var(--neutral-60)]">
            <MapPin
              size={14}
              weight="fill"
              className="shrink-0 mt-0.5"
            />
            <span className="line-clamp-2">
              {place.address || location}
            </span>
          </div>
        )}

        {savedPlace.notes && (
          <p className="text-xs text-[var(--neutral-50)] italic line-clamp-2">
            {savedPlace.notes}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          {place.rating !== null ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <Star size={14} weight="fill" />
              {place.rating.toFixed(1)}
            </span>
          ) : (
            <span />
          )}

          <span className="text-xs text-[var(--neutral-50)]">
            Saved{' '}
            {formatDistanceToNow(new Date(savedPlace.savedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>

      <button
        onClick={() => onRemove(savedPlace)}
        className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full bg-[var(--neutral-10)]/90 backdrop-blur-sm border border-[var(--neutral-30)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
        title="Remove from collection"
      >
        <Trash
          size={14}
          weight="bold"
          className="text-[var(--neutral-60)] hover:text-red-600"
        />
      </button>
    </motion.div>
  );
}

interface EditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    isPublic: boolean;
  }) => void;
  isSubmitting: boolean;
  initial: { name: string; description: string; isPublic: boolean };
}

function EditModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  initial,
}: EditModalProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [isPublic, setIsPublic] = useState(initial.isPublic);

  useEffect(() => {
    if (open) {
      setName(initial.name);
      setDescription(initial.description);
      setIsPublic(initial.isPublic);
    }
  }, [open, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description, isPublic });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Update your collection details.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="edit-collection-name"
                className="text-sm font-medium text-[var(--neutral-100)]"
              >
                Name
              </label>
              <Input
                id="edit-collection-name"
                placeholder="e.g. Tokyo Favorites"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="edit-collection-description"
                className="text-sm font-medium text-[var(--neutral-100)]"
              >
                Description (optional)
              </label>
              <Textarea
                id="edit-collection-description"
                placeholder="A short description of this collection..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--neutral-100)]">
                  Public
                </p>
                <p className="text-xs text-[var(--neutral-60)]">
                  Allow others to discover this collection
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  isPublic
                    ? 'bg-[var(--primary-main)]'
                    : 'bg-[var(--neutral-30)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CollectionDetailContent() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<SavedPlace | null>(
    null
  );
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchCollection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result =
        await collectionService.getCollection(collectionId);
      setCollection(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to load collection';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const handleEditSubmit = async (data: {
    name: string;
    description: string;
    isPublic: boolean;
  }) => {
    setIsEditing(true);
    try {
      const updated = await collectionService.updateCollection(
        collectionId,
        data
      );
      setCollection((prev) =>
        prev ? { ...prev, ...updated } : updated
      );
      setEditOpen(false);
    } catch (err) {
      console.error('Failed to update collection:', err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await collectionService.removePlace(
        collectionId,
        removeTarget.placeId
      );
      setCollection((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          saved_places: prev.saved_places?.filter(
            (sp) => sp.id !== removeTarget.id
          ),
          _count: prev._count
            ? {
                saved_places: prev._count.saved_places - 1,
              }
            : undefined,
        };
      });
      setRemoveTarget(null);
    } catch (err) {
      console.error('Failed to remove place:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="h-8 bg-[var(--neutral-20)] rounded w-48 mb-2 animate-pulse" />
        <div className="h-5 bg-[var(--neutral-20)] rounded w-32 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonPlaceCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <Button
          onClick={fetchCollection}
          variant="outline"
          className="text-sm"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!collection) return null;

  const places = collection.saved_places ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <button
        onClick={() => router.push('/collections')}
        className="flex items-center gap-1.5 text-sm text-[var(--neutral-60)] hover:text-[var(--primary-main)] transition-colors mb-6"
      >
        <ArrowLeft size={16} weight="bold" />
        Back to Collections
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-semibold text-[var(--neutral-100)]">
              {collection.name}
            </h2>
            <Badge
              className={`text-[11px] font-semibold px-2 py-0.5 ${
                collection.isPublic
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
              }`}
            >
              {collection.isPublic ? (
                <Globe size={12} weight="bold" className="mr-1" />
              ) : (
                <Lock size={12} weight="bold" className="mr-1" />
              )}
              {collection.isPublic ? 'Public' : 'Private'}
            </Badge>
          </div>

          {collection.description && (
            <p className="text-sm text-[var(--neutral-60)] mt-1 max-w-lg">
              {collection.description}
            </p>
          )}

          <p className="text-xs text-[var(--neutral-50)] mt-2">
            {places.length} {places.length === 1 ? 'place' : 'places'}{' '}
            &middot; Updated{' '}
            {formatDistanceToNow(new Date(collection.updatedAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        <Button
          onClick={() => setEditOpen(true)}
          variant="outline"
          className="text-sm w-fit"
        >
          <PencilSimple size={16} className="mr-1.5" />
          Edit Collection
        </Button>
      </div>

      {places.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-[var(--primary-surface)] flex items-center justify-center mb-6">
            <BookmarkSimple
              size={36}
              weight="duotone"
              className="text-[var(--primary-main)]"
            />
          </div>
          <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-2">
            No places saved yet
          </h3>
          <p className="text-sm text-[var(--neutral-60)] max-w-xs">
            Start exploring and save places to this collection from the
            travel assistant or explore page.
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {places.map((savedPlace, i) => (
              <PlaceCard
                key={savedPlace.id}
                savedPlace={savedPlace}
                index={i}
                onRemove={setRemoveTarget}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <EditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEditSubmit}
        isSubmitting={isEditing}
        initial={{
          name: collection.name,
          description: collection.description ?? '',
          isPublic: collection.isPublic,
        }}
      />

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Place</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;
              {removeTarget?.cached_places.name}&quot; from this
              collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={isRemoving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CollectionDetailPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <CollectionDetailContent />
    </>
  );
}
