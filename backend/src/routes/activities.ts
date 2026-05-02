import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listActivities,
  listActivitiesByLead,
  createActivityHandler,
} from '../controllers/activityController';

const router = Router();

router.get('/',                requireAuth, listActivities);
router.get('/lead/:leadId',    requireAuth, listActivitiesByLead);
router.post('/',               requireAuth, createActivityHandler);

export default router;
