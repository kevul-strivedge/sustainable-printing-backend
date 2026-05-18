import { Router } from 'express';
import { submitQuote } from '../controllers/quoteController.js';

const router = Router();

router.post('/submit', submitQuote);

export default router;
