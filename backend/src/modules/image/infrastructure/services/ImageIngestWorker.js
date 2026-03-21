/**
 * Image Ingest Worker
 * Job processor: download → validate → upload to R2 → update DB
 */

import crypto from 'crypto';
import imageAssetRepository from '../repositories/ImageAssetRepository.js';
import r2StorageService from './R2StorageService.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_SIZE = 1024; // 1KB
const DOWNLOAD_TIMEOUT = 15000; // 15s

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Process a single image ingest job
 * Job data: { sourceUrl, sourceProvider, entityType, entityId }
 */
export async function processImageIngestJob(job) {
  const { sourceUrl, sourceProvider, entityType, entityId } = job.data;
  logger.info(`[ImageIngest] Processing: ${sourceUrl} (${sourceProvider})`);

  // 1. Dedup by sourceUrl — if already READY, just link
  const existing = await imageAssetRepository.findBySourceUrl(sourceUrl);
  if (existing && existing.status === 'READY') {
    logger.info(`[ImageIngest] Already ingested (${existing.id}), linking to ${entityType}:${entityId}`);
    await linkAssetToEntity(existing.id, entityType, entityId);
    return { status: 'dedup_linked', assetId: existing.id };
  }

  // 2. Create or reuse asset record
  let asset;
  if (existing) {
    asset = await imageAssetRepository.updateStatus(existing.id, 'PROCESSING', {
      attempts: existing.attempts + 1,
    });
  } else {
    asset = await imageAssetRepository.create({
      sourceUrl,
      sourceProvider,
      status: 'PROCESSING',
      attempts: 1,
    });
  }

  try {
    // 3. Download image
    const response = await Promise.race([
      fetch(sourceUrl, {
        headers: { 'User-Agent': 'ATrips-ImageIngest/1.0' },
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Download timeout after ${DOWNLOAD_TIMEOUT}ms`)), DOWNLOAD_TIMEOUT);
      }),
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 4. Validate content type
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 5. Validate size
    if (buffer.length > MAX_SIZE) {
      throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_SIZE})`);
    }
    if (buffer.length < MIN_SIZE) {
      throw new Error(`File too small: ${buffer.length} bytes (min ${MIN_SIZE})`);
    }

    // 6. Content hash for dedup
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const hashDup = await imageAssetRepository.findByContentHash(contentHash);
    if (hashDup && hashDup.id !== asset.id) {
      // Same content already exists — link and clean up
      logger.info(`[ImageIngest] Content hash match (${hashDup.id}), dedup`);
      await linkAssetToEntity(hashDup.id, entityType, entityId);
      await imageAssetRepository.delete(asset.id);
      return { status: 'hash_dedup', assetId: hashDup.id };
    }

    // 7. Upload to R2
    const ext = MIME_TO_EXT[contentType] || 'jpg';
    const r2Key = r2StorageService.buildKey(sourceProvider, asset.id, ext);
    const { bucket } = await r2StorageService.upload(r2Key, buffer, contentType);

    // 8. Generate variant URLs
    const variants = r2StorageService.getVariantUrls(r2Key);

    // 9. Update DB → READY (handle race with other jobs)
    try {
      await imageAssetRepository.markReady(asset.id, {
        contentHash,
        r2Key,
        r2Bucket: bucket,
        fileSize: buffer.length,
        mimeType: contentType,
        variants,
      });
    } catch (err) {
      if (err.code === 'P2002') {
        // Another job wrote the same contentHash — dedup
        const winner = await imageAssetRepository.findByContentHash(contentHash);
        if (winner) {
          await linkAssetToEntity(winner.id, entityType, entityId);
          await imageAssetRepository.delete(asset.id);
          logger.info(`[ImageIngest] Race dedup → ${winner.id}`);
          return { status: 'race_dedup', assetId: winner.id };
        }
      }
      throw err;
    }

    // 10. Link to entity
    await linkAssetToEntity(asset.id, entityType, entityId);

    logger.info(`[ImageIngest] Done: ${asset.id} → ${r2Key}`);
    return { status: 'uploaded', assetId: asset.id, r2Key };
  } catch (error) {
    logger.error(`[ImageIngest] Failed for ${sourceUrl}: ${error.message}`);
    await imageAssetRepository.markFailed(asset.id, error.message, asset.attempts);
    throw error; // Let BullMQ handle retry
  }
}

/**
 * Link an image asset to an entity (activity or trip cover)
 */
async function linkAssetToEntity(assetId, entityType, entityId) {
  if (!entityType || !entityId) return;

  try {
    if (entityType === 'activity') {
      await imageAssetRepository.linkToActivity(entityId, assetId);
    } else if (entityType === 'trip_cover') {
      await imageAssetRepository.linkToTripCover(entityId, assetId);
    }
  } catch (err) {
    logger.warn(`[ImageIngest] Failed to link asset ${assetId} to ${entityType}:${entityId}: ${err.message}`);
  }
}
