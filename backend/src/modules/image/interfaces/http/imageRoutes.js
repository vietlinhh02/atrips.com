/**
 * Image Routes
 * API endpoints for image asset management
 */

import { Router } from 'express';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import imageController from './imageController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/images/queue/stats
 * @desc Get queue and asset statistics
 * @access Private (admin)
 */
router.get('/queue/stats', asyncHandler((req, res) => imageController.getQueueStats(req, res)));

/**
 * @route GET /api/images/:id
 * @desc Get image asset by ID
 * @access Private
 */
router.get('/:id', asyncHandler((req, res) => imageController.getImageAsset(req, res)));

/**
 * @route POST /api/images/ingest
 * @desc Manually trigger image ingestion
 * @access Private (admin)
 */
router.post('/ingest', asyncHandler((req, res) => imageController.triggerIngest(req, res)));

export default router;
