/**
 * Image Asset Repository
 * CRUD operations for image_assets table
 */

import prisma from '../../../../config/database.js';

export class ImageAssetRepository {
  async findById(id) {
    return prisma.image_assets.findUnique({ where: { id } });
  }

  async findBySourceUrl(sourceUrl) {
    return prisma.image_assets.findFirst({ where: { sourceUrl } });
  }

  async findByContentHash(contentHash) {
    return prisma.image_assets.findUnique({ where: { contentHash } });
  }

  async create(data) {
    return prisma.image_assets.create({ data });
  }

  async updateStatus(id, status, extra = {}) {
    return prisma.image_assets.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async markReady(id, { contentHash, r2Key, r2Bucket, width, height, fileSize, mimeType, variants }) {
    return prisma.image_assets.update({
      where: { id },
      data: {
        status: 'READY',
        contentHash,
        r2Key,
        r2Bucket,
        width,
        height,
        fileSize,
        mimeType,
        variants,
      },
    });
  }

  async markFailed(id, error, attempts) {
    return prisma.image_assets.update({
      where: { id },
      data: {
        status: attempts >= 3 ? 'FAILED' : 'PENDING',
        lastError: String(error).slice(0, 500),
        attempts,
      },
    });
  }

  async linkToActivity(activityId, imageAssetId) {
    return prisma.activities.update({
      where: { id: activityId },
      data: { imageAssetId },
    });
  }

  async linkToTripCover(tripId, imageAssetId) {
    return prisma.trips.update({
      where: { id: tripId },
      data: { coverImageAssetId: imageAssetId },
    });
  }

  async getByStatus(status, limit = 50) {
    return prisma.image_assets.findMany({
      where: { status },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getStats() {
    const [pending, processing, ready, failed, total] = await Promise.all([
      prisma.image_assets.count({ where: { status: 'PENDING' } }),
      prisma.image_assets.count({ where: { status: 'PROCESSING' } }),
      prisma.image_assets.count({ where: { status: 'READY' } }),
      prisma.image_assets.count({ where: { status: 'FAILED' } }),
      prisma.image_assets.count(),
    ]);
    return { pending, processing, ready, failed, total };
  }
}

export default new ImageAssetRepository();
