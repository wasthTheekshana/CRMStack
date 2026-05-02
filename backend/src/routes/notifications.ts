// backend/src/routes/notifications.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listNotifications,
  markAllReadHandler,
  dismissNotificationHandler,
} from '../controllers/notificationController';

const router = Router();

router.get('/',               requireAuth, listNotifications);
router.post('/mark-all-read', requireAuth, markAllReadHandler);
router.delete('/:id',         requireAuth, dismissNotificationHandler);

export default router;
