import { Router } from 'express';
import { submitCustomQuote } from '../controllers/customQuoteController.js';

const router = Router();

router.post('/', submitCustomQuote);

export default router;
