import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/superAdminAuth';
import {
  findAllTenants,
  findTenantById,
  createTenant,
  updateTenant,
} from '../models/tenantModel';

const router = Router();

// These routes operate across ALL tenants, so they must be restricted to the
// platform super admin. A tenant-level admin must never reach them — that would
// allow cross-tenant data access and the ability to suspend other tenants.
router.use(requireSuperAdmin);

// GET /api/tenants — list all tenants (super admin only)
router.get('/', async (_req, res) => {
  try {
    const tenants = await findAllTenants();
    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tenants/:id — get one tenant
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.patch('/:id', async (req, res) => {
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
