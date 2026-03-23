import type { ImageAsset } from '@/src/services/tripService';

type VariantSize = 'thumb' | 'card' | 'hero';

export function resolveActivityImage(
  activity: { image_assets?: ImageAsset | null },
  size: VariantSize = 'card'
): string | null {
  const asset = activity.image_assets;
  if (!asset) return null;

  if (asset.status === 'READY' && asset.variants) {
    return asset.variants[size];
  }

  if (asset.sourceUrl) {
    return asset.sourceUrl;
  }

  return null;
}

export function resolveTripCoverImage(
  trip: { coverImageAsset?: ImageAsset | null; coverImageUrl?: string | null },
  size: VariantSize = 'card'
): string | null {
  const asset = trip.coverImageAsset;

  if (asset) {
    if (asset.status === 'READY' && asset.variants) {
      return asset.variants[size];
    }
    if (asset.sourceUrl) {
      return asset.sourceUrl;
    }
  }

  return trip.coverImageUrl ?? null;
}
