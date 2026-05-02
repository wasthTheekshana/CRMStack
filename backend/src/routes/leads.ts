import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateUUIDParam } from '../middleware/validateUUID';
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
router.get('/:id/expiry',    requireAuth, validateUUIDParam('id'), getLeadExpiryHandler);
router.put('/:id/expiry',    requireAuth, validateUUIDParam('id'), setLeadExpiryHandler);
router.delete('/:id/expiry', requireAuth, validateUUIDParam('id'), deleteLeadExpiryHandler);
router.get('/:id',           requireAuth, validateUUIDParam('id'), getLead);
router.post('/',             requireAuth,               createLeadHandler);
router.put('/:id',           requireAuth, validateUUIDParam('id'), updateLeadHandler);
router.delete('/:id',        requireAuth, validateUUIDParam('id'), deleteLeadHandler);
router.put('/:id/restore',   requireAuth, requireAdmin, validateUUIDParam('id'), restoreLeadHandler);
router.patch('/:id/owner',   requireAuth, requireAdmin, validateUUIDParam('id'), reassignLeadHandler);

export default router;
