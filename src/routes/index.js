import { Router } from 'express';
import productRoutes from './productRoutes.js';
import authRoutes from './authRoutes.js';
import orderRoutes from './orderRoutes.js';
import configuratorRoutes from './configuratorRoutes.js';
import artworkRoutes from './artworkRoutes.js';
import quoteRoutes from './quoteRoutes.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/configurator', configuratorRoutes);
router.use('/artwork', artworkRoutes);
router.use('/quotes', quoteRoutes);

export default router;
