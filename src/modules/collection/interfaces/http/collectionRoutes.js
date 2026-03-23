/**
 * Collection Routes
 * Defines routes for collection and saved places endpoints
 */

import { Router } from 'express';
import collectionController from './collectionController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Collection listing
router.get('/', collectionController.listCollections);
router.get('/public', collectionController.listPublicCollections);
router.get('/saved-places', collectionController.listSavedPlaces);

// Single collection CRUD
router.get('/:id', collectionController.getCollection);
router.post('/', collectionController.createCollection);
router.patch('/:id', collectionController.updateCollection);
router.delete('/:id', collectionController.deleteCollection);

// Saved places within a collection
router.post('/:id/places', collectionController.addPlace);
router.delete('/:id/places/:placeId', collectionController.removePlace);

export default router;
