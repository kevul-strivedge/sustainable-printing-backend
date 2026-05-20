import { Router } from 'express';
import { submitSamplePack } from '../controllers/samplePackController.js';

const router = Router();

router.post('/', submitSamplePack);

export default router;
