import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  findAllTenants,
  findTenantById,
  createTenant,
  updateTenant,
} from '../models/tenantModel';

const router = Router();

// GET /api/tenants — list all tenants (super admin only, for now requires admin)
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const tenants = await findAllTenants();
    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tenants/:id — get one tenant
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenant = await findTenantById(req.params.id);
    if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
    res.json(tenant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tenants — create a new tenant
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, subdomain, plan, userLimit, ownerEmail } = req.body;
  if (!name || !subdomain || !ownerEmail) {
    res.status(400).json({ error: 'name, subdomain, ownerEmail required' });
    return;
  }
  try {
    const tenant = await createTenant({
      name, subdomain,
      plan:       plan || 'starter',
      userLimit:  userLimit || 3,
      ownerEmail,
    });
    res.status(201).json(tenant);
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23505') { res.status(409).json({ error: 'Subdomain already exists' }); return; }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tenants/:id — update tenant
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, plan, status, userLimit, ownerEmail } = req.body;
  try {
    const tenant = await updateTenant(req.params.id, { name, plan, status, userLimit, ownerEmail });
    if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
    res.json(tenant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
