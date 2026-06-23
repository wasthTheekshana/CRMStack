import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getKpis, getCustomWidgets } from '../controllers/kpiController';

const router = Router();

router.get('/', requireAuth, getKpis);
router.get('/custom-widgets', requireAuth, getCustomWidgets);

export default router;
