import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateUUIDParam } from '../middleware/validateUUID';
import {
  listActivities,
  listActivitiesByLead,
  createActivityHandler,
  updateActivityHandler,
} from '../controllers/activityController';

const router = Router();

router.get('/',                requireAuth, listActivities);
router.get('/lead/:leadId',    requireAuth, listActivitiesByLead);
router.post('/',               requireAuth, createActivityHandler);
router.put('/:id',             requireAuth, validateUUIDParam('id'), updateActivityHandler);

export default router;
