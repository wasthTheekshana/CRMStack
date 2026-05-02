import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listTargets,
  createTargetHandler,
  updateTargetHandler,
  deleteTargetHandler,
} from '../controllers/salesTargetController';

const router = Router();

router.get('/',     requireAuth,               listTargets);
router.post('/',    requireAuth,               createTargetHandler);
router.put('/:id',  requireAuth,               updateTargetHandler);
router.delete('/:id', requireAuth, requireAdmin, deleteTargetHandler);

export default router;
