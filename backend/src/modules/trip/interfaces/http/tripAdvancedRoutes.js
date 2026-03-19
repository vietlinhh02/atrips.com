import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import tripAdvancedController from './tripAdvancedController.js';

const router = Router();

router.use(authenticate);

router.post('/:tripId/duplicate', tripAdvancedController.duplicateTrip);
router.patch('/:tripId/archive', tripAdvancedController.archiveTrip);
router.patch('/:tripId/restore', tripAdvancedController.restoreTrip);
router.get('/:tripId/status-history', tripAdvancedController.getStatusHistory);
router.post('/:tripId/export/pdf', tripAdvancedController.exportPdf);
router.get('/:tripId/exports', tripAdvancedController.getExports);

export default router;
