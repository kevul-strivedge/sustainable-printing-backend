import { Router } from 'express';
import { uploadArtwork } from '../controllers/artworkController.js';

const router = Router();

router.post('/upload', uploadArtwork);

export default router;
