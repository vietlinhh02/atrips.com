import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as placeController from './placeController.js';

const router = Router();

router.use(authenticate);

router.get(
  '/lookup',
  placeController.lookupPlaceValidation,
  placeController.lookupPlace
);
router.get('/:placeId/enrich', placeController.enrichPlace);
router.get(
  '/search',
  placeController.searchPlacesValidation,
  placeController.searchPlaces
);

export default router;
