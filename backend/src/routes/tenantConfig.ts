import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getConfig, updateConfig } from '../controllers/tenantConfigController';

const router = Router();

// GET  /api/tenant/config  — any authenticated user can read their tenant's config
router.get('/', requireAuth, getConfig);

// PUT  /api/tenant/config  — only admins can update it
router.put('/', requireAuth, requireAdmin, updateConfig);

export default router;
