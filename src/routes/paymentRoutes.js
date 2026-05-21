import { Router } from 'express';
import { processCardPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Optional auth: if a Bearer token is present it's verified, but guests can also pay
router.post('/:quoteId/pay', optionalProtect, processCardPayment);

function optionalProtect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  protect(req, res, next);
}

export default router;
