'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  BookmarkSimple,
  Plus,
  Trash,
  PencilSimple,
  DotsThreeVertical,
  FolderSimple,
  Globe,
  Lock,
} from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
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
import type { Collection } from '@/src/services/collectionService';

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden animate-pulse">
      <div className="h-36 bg-[var(--neutral-30)]" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-[var(--neutral-30)] rounded w-3/4" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-5 bg-[var(--neutral-20)] rounded w-20" />
          <div className="h-5 bg-[var(--neutral-20)] rounded w-16" />
        </div>
      </div>
    </div>
  );
}

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
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

interface CollectionCardProps {
  collection: Collection;
  index: number;
  onNavigate: (id: string) => void;
  onEdit: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}

function CollectionCard({
  collection,
  index,
  onNavigate,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const placeCount = collection._count?.saved_places ?? 0;
  const gradient = getGradient(collection.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden
        hover:shadow-lg hover:border-[var(--primary-outer-border)] transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
    >
      <button
        onClick={() => onNavigate(collection.id)}
        className="w-full text-left"
      >
        <div className="relative h-36 overflow-hidden">
          {collection.coverImage ? (
            <img
              src={collection.coverImage}
              alt={collection.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <BookmarkSimple
                size={48}
                weight="thin"
                className="text-white/30"
              />
            </div>
          )}

          <div className="absolute top-3 left-3">
            <Badge
              className={`text-[11px] font-semibold px-2 py-0.5 shadow-sm ${
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
        </div>

        <div className="p-4 space-y-2">
          <h3 className="text-[15px] font-semibold text-[var(--neutral-100)] line-clamp-1 group-hover:text-[var(--primary-main)] transition-colors">
            {collection.name}
          </h3>

          {collection.description && (
            <p className="text-xs text-[var(--neutral-60)] line-clamp-2">
              {collection.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[var(--neutral-60)]">
              {placeCount} {placeCount === 1 ? 'place' : 'places'}
            </span>
            <span className="text-xs text-[var(--neutral-50)]">
              {formatDistanceToNow(new Date(collection.updatedAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </button>

      <div className="absolute top-3 right-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-[var(--neutral-10)]/90 backdrop-blur-sm border border-[var(--neutral-30)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--neutral-20)]"
            >
              <DotsThreeVertical
                size={16}
                weight="bold"
                className="text-[var(--neutral-70)]"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(collection);
              }}
              className="cursor-pointer"
            >
              <PencilSimple size={16} className="mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(collection);
              }}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash size={16} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center pt-12 pb-20 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-[var(--primary-surface)] flex items-center justify-center mb-6">
        <BookmarkSimple
          size={36}
          weight="duotone"
          className="text-[var(--primary-main)]"
        />
      </div>
      <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-2">
        No collections yet
      </h3>
      <p className="text-sm text-[var(--neutral-60)] max-w-xs mb-6">
        Create your first collection to save and organize your favorite places.
      </p>
      <Button
        onClick={onCreate}
        className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-5 py-2.5 text-sm font-medium"
      >
        <Plus size={16} weight="bold" className="mr-1.5" />
        Create Collection
      </Button>
    </motion.div>
  );
}

interface CollectionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    isPublic: boolean;
  }) => void;
  isSubmitting: boolean;
  initial?: { name: string; description: string; isPublic: boolean };
  mode: 'create' | 'edit';
}

function CollectionFormModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  initial,
  mode,
}: CollectionFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(
    initial?.description ?? ''
  );
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setIsPublic(initial?.isPublic ?? false);
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
            <AlertDialogTitle>
              {mode === 'create'
                ? 'Create Collection'
                : 'Edit Collection'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'create'
                ? 'Create a new collection to organize your saved places.'
                : 'Update your collection details.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="collection-name"
                className="text-sm font-medium text-[var(--neutral-100)]"
              >
                Name
              </label>
              <Input
                id="collection-name"
                placeholder="e.g. Tokyo Favorites"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="collection-description"
                className="text-sm font-medium text-[var(--neutral-100)]"
              >
                Description (optional)
              </label>
              <Textarea
                id="collection-description"
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
              {isSubmitting
                ? 'Saving...'
                : mode === 'create'
                  ? 'Create'
                  : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CollectionsContent() {
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await collectionService.listCollections({
        limit: 100,
      });
      setCollections(result.collections);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to load collections';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreate = () => {
    setEditTarget(null);
    setFormMode('create');
    setFormOpen(true);
  };

  const handleEdit = (collection: Collection) => {
    setEditTarget(collection);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    name: string;
    description: string;
    isPublic: boolean;
  }) => {
    setIsSubmitting(true);
    try {
      if (formMode === 'create') {
        const created = await collectionService.createCollection(data);
        setCollections((prev) => [created, ...prev]);
      } else if (editTarget) {
        const updated = await collectionService.updateCollection(
          editTarget.id,
          data
        );
        setCollections((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Failed to save collection:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await collectionService.deleteCollection(deleteTarget.id);
      setCollections((prev) =>
        prev.filter((c) => c.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete collection:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--neutral-100)]">
            My Collections
          </h2>
          {!isLoading && (
            <p className="text-sm text-[var(--neutral-60)] mt-0.5">
              {collections.length}{' '}
              {collections.length === 1 ? 'collection' : 'collections'}
            </p>
          )}
        </div>

        <Button
          onClick={handleCreate}
          className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-4 py-2 text-sm font-medium
            shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] w-fit"
        >
          <Plus size={16} weight="bold" className="mr-1.5" />
          Create Collection
        </Button>
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
            onClick={fetchCollections}
            variant="outline"
            className="text-sm"
          >
            Try Again
          </Button>
        </div>
      ) : collections.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {collections.map((collection, i) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                index={i}
                onNavigate={(id) => router.push(`/collections/${id}`)}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <CollectionFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        mode={formMode}
        initial={
          editTarget
            ? {
                name: editTarget.name,
                description: editTarget.description ?? '',
                isPublic: editTarget.isPublic,
              }
            : undefined
        }
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}
              &quot;? This will remove all saved places in this
              collection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <CollectionsContent />
    </>
  );
}
