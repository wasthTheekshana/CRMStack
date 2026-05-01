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
import {
  getBulkLeadExpiryHandler,
  getLeadExpiryHandler,
  setLeadExpiryHandler,
  deleteLeadExpiryHandler,
} from '../controllers/leadExpiryController';

const router = Router();

router.get('/',              requireAuth,               listLeads);
router.get('/deleted',       requireAuth,               listDeletedLeads);
router.get('/expiry/bulk',   requireAuth,               getBulkLeadExpiryHandler);
router.get('/:id/expiry',    requireAuth,               getLeadExpiryHandler);
router.put('/:id/expiry',    requireAuth,               setLeadExpiryHandler);
router.delete('/:id/expiry', requireAuth,               deleteLeadExpiryHandler);
router.get('/:id',           requireAuth,               getLead);
router.post('/',             requireAuth,               createLeadHandler);
router.put('/:id',           requireAuth,               updateLeadHandler);
router.delete('/:id',        requireAuth,               deleteLeadHandler);
router.put('/:id/restore',   requireAuth, requireAdmin, restoreLeadHandler);
router.patch('/:id/owner',   requireAuth, requireAdmin, reassignLeadHandler);

export default router;
