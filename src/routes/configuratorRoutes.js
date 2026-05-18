import { Router } from 'express';
import {
  getProductConfig,
  getProductQuantities,
  getProductPrice,
} from '../controllers/configuratorController.js';

const router = Router();

router.get('/:productId/config', getProductConfig);
router.get('/:productId/quantities', getProductQuantities);
router.get('/:productId/price', getProductPrice);

export default router;
