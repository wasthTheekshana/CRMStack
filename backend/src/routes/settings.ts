import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

router.get('/:userId',  requireAuth, getSettings);
router.put('/:userId',  requireAuth, updateSettings);

export default router;
