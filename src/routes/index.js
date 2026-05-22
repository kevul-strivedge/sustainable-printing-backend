import { Router } from 'express';
import productRoutes from './productRoutes.js';
import authRoutes from './authRoutes.js';
import orderRoutes from './orderRoutes.js';
import configuratorRoutes from './configuratorRoutes.js';
import artworkRoutes from './artworkRoutes.js';
import quoteRoutes from './quoteRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import customQuoteRoutes from './customQuoteRoutes.js';
import samplePackRoutes from './samplePackRoutes.js';
import deliveryRoutes from './deliveryRoutes.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/configurator', configuratorRoutes);
router.use('/artwork', artworkRoutes);
router.use('/quotes', quoteRoutes);
router.use('/payments', paymentRoutes);
router.use('/custom-quotes', customQuoteRoutes);
router.use('/sample-pack', samplePackRoutes);
router.use('/delivery', deliveryRoutes);

export default router;
