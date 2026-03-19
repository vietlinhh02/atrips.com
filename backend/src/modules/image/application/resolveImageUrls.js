/**
 * URL Resolution Utility
 * Resolves activity/trip images to CDN URLs or fallback source URLs
 */

/**
 * Resolve image URLs for an activity
 * Returns CDN variant URLs if ready, or fallback to source URL
 */
export function resolveActivityImageUrls(activity) {
  // CDN ready → return variants
  if (activity.image_assets?.status === 'READY' && activity.image_assets.variants) {
    return {
      ...activity.image_assets.variants,
      status: 'ready',
      assetId: activity.image_assets.id,
    };
  }

  // Find fallback URL from cached_places photos or activity data
  const fallbackUrl = activity.image_assets?.sourceUrl
    || activity.cached_places?.photos?.[0]
    || null;

  if (!fallbackUrl) {
    return { thumb: null, card: null, hero: null, original: null, status: 'none' };
  }

  // Pending/Processing → return source URL as fallback for all sizes
  const status = activity.image_assets?.status === 'PROCESSING' ? 'processing'
    : activity.image_assets?.status === 'FAILED' ? 'failed'
    : 'pending';

  return {
    thumb: fallbackUrl,
    card: fallbackUrl,
    hero: fallbackUrl,
    original: fallbackUrl,
    status,
  };
}

/**
 * Resolve cover image for a trip
 */
export function resolveTripCoverImageUrls(trip) {
  if (trip.coverImageAsset?.status === 'READY' && trip.coverImageAsset.variants) {
    return {
      ...trip.coverImageAsset.variants,
      status: 'ready',
      assetId: trip.coverImageAsset.id,
    };
  }

  const fallbackUrl = trip.coverImageAsset?.sourceUrl || trip.coverImageUrl || null;

  if (!fallbackUrl) {
    return { thumb: null, card: null, hero: null, original: null, status: 'none' };
  }

  const status = trip.coverImageAsset?.status === 'PROCESSING' ? 'processing'
    : trip.coverImageAsset?.status === 'FAILED' ? 'failed'
    : 'pending';

  return {
    thumb: fallbackUrl,
    card: fallbackUrl,
    hero: fallbackUrl,
    original: fallbackUrl,
    status,
  };
}
