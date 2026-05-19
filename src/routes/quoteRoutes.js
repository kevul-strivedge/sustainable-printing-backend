import { Router } from 'express';
import { submitQuote, getQuote, getMyOrders, attachArtwork, sendQuoteEmail, reQuote, downloadQuotePdf } from '../controllers/quoteController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/my-orders', protect, getMyOrders);
router.post('/submit', submitQuote);
router.post('/:id/artwork', protect, attachArtwork);
router.post('/:id/send-email', protect, sendQuoteEmail);
router.post('/:id/requote', protect, reQuote);
router.get('/:id/pdf', protect, downloadQuotePdf);
router.get('/:id', getQuote);

export default router;
