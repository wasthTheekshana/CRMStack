import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { importPreview, importConfirm } from '../controllers/importController';

const router = Router();

router.post('/preview', requireAuth, requireAdmin, importPreview);
router.post('/confirm', requireAuth, requireAdmin, importConfirm);

export default router;
