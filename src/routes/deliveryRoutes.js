import express from 'express';
import { getDeliveryPrice } from '../controllers/deliveryController.js';

const router = express.Router();

router.get('/price', getDeliveryPrice);

export default router;
