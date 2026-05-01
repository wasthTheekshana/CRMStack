import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listLeads,
  listDeletedLeads,
  getLead,
  createLeadHandler,
  updateLeadHandler,
  deleteLeadHandler,
  restoreLeadHandler,
  reassignLeadHandler,
} from '../controllers/leadController';

const router = Router();

router.get('/',              requireAuth,               listLeads);
router.get('/deleted',       requireAuth,               listDeletedLeads);
router.get('/:id',           requireAuth,               getLead);
router.post('/',             requireAuth,               createLeadHandler);
router.put('/:id',           requireAuth,               updateLeadHandler);
router.delete('/:id',        requireAuth,               deleteLeadHandler);
router.put('/:id/restore',   requireAuth, requireAdmin, restoreLeadHandler);
router.patch('/:id/owner',   requireAuth, requireAdmin, reassignLeadHandler);

export default router;
