/**
 * Image Controller
 * Handles image asset API requests
 */

import imageAssetRepository from '../../infrastructure/repositories/ImageAssetRepository.js';
import imageQueueService from '../../infrastructure/services/ImageQueueService.js';
import { AppError } from '../../../../shared/errors/AppError.js';

export class ImageController {
  /**
   * GET /api/images/:id
   * Get image asset status + URLs
   */
  async getImageAsset(req, res) {
    const { id } = req.params;
    const asset = await imageAssetRepository.findById(id);

    if (!asset) {
      throw AppError.notFound('Image asset not found');
    }

    res.json({
      success: true,
      data: {
        id: asset.id,
        status: asset.status,
        sourceUrl: asset.sourceUrl,
        sourceProvider: asset.sourceProvider,
        variants: asset.variants,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        createdAt: asset.createdAt,
      },
    });
  }

  /**
   * POST /api/images/ingest
   * Manual trigger for image ingestion (admin)
   */
  async triggerIngest(req, res) {
    if (!imageQueueService.isReady) {
      throw AppError.badRequest('Image queue is not configured');
    }

    const { sourceUrl, sourceProvider, entityType, entityId } = req.body;

    if (!sourceUrl) {
      throw AppError.badRequest('sourceUrl is required');
    }

    const job = await imageQueueService.addJob({
      sourceUrl,
      sourceProvider: sourceProvider || 'USER_UPLOAD',
      entityType: entityType || null,
      entityId: entityId || null,
    });

    res.json({
      success: true,
      data: { jobId: job?.id, message: 'Image ingest job queued' },
    });
  }

  /**
   * GET /api/images/queue/stats
   * Queue statistics (admin)
   */
  async getQueueStats(req, res) {
    const queueStats = await imageQueueService.getStats();
    const dbStats = await imageAssetRepository.getStats();

    res.json({
      success: true,
      data: {
        queue: queueStats,
        assets: dbStats,
      },
    });
  }
}

export default new ImageController();
