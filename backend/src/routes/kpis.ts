import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getKpis } from '../controllers/kpiController';

const router = Router();

router.get('/', requireAuth, getKpis);

export default router;
