import type { ImageAsset } from '@/src/services/tripService';

type VariantSize = 'thumb' | 'card' | 'hero';

function resolveAsset(
  asset: ImageAsset | null | undefined,
  size: VariantSize,
): string | null {
  if (!asset) return null;

  // Prefer sourceUrl (Pexels, Serper, etc.) as R2 CDN is not public yet.
  // When a custom domain is configured for R2, swap priority to variants.
  if (asset.sourceUrl) {
    return asset.sourceUrl;
  }

  if (asset.status === 'READY' && asset.variants) {
    return asset.variants[size];
  }

  return null;
}

export function resolveActivityImage(
  activity: { image_assets?: ImageAsset | null },
  size: VariantSize = 'card',
): string | null {
  return resolveAsset(activity.image_assets, size);
}

export function resolveTripCoverImage(
  trip: { coverImageAsset?: ImageAsset | null; coverImageUrl?: string | null },
  size: VariantSize = 'card',
): string | null {
  return resolveAsset(trip.coverImageAsset, size) ?? trip.coverImageUrl ?? null;
}
