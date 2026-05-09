import { Request, Response, NextFunction } from 'express';
import { findTenantBySubdomain, findTenantById, Tenant } from '../models/tenantModel';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

/**
 * Resolves the tenant from the incoming request.
 *
 * In production (behind nginx), the subdomain is extracted and forwarded
 * as the X-Tenant-Subdomain header.
 *
 * In local development, falls back to:
 *   1. X-Tenant-Id header (explicit tenant UUID)
 *   2. The default dev tenant (subdomain = 'dok')
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Try subdomain header (set by nginx in production)
    const subdomain = req.headers['x-tenant-subdomain'] as string | undefined;
    if (subdomain) {
      const tenant = await findTenantBySubdomain(subdomain);
      if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) {
        res.status(404).json({ error: 'Tenant not found or suspended' });
        return;
      }
      req.tenant = tenant;
      return next();
    }

    // 2. Try explicit tenant ID header — only in non-production (C6: prevents tenant impersonation)
    if (process.env.NODE_ENV !== 'production') {
      const tenantId = req.headers['x-tenant-id'] as string | undefined;
      if (tenantId) {
        const tenant = await findTenantById(tenantId);
        if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) {
          res.status(404).json({ error: 'Tenant not found or suspended' });
          return;
        }
        req.tenant = tenant;
        return next();
      }
    }

    // 3. Local dev fallback — use the seeded default tenant
    if (process.env.NODE_ENV !== 'production') {
      const tenant = await findTenantBySubdomain('dok');
      if (tenant) {
        req.tenant = tenant;
        return next();
      }
    }

    res.status(400).json({ error: 'Tenant could not be determined' });
  } catch (err) {
    console.error('tenantResolver error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Like resolveTenant but non-blocking: if no tenant can be determined,
 * calls next() with req.tenant left undefined instead of returning 400.
 * Use on routes (e.g. login) that can operate without a resolved tenant.
 */
export async function resolveTenantOptional(req: Request, res: Response, next: NextFunction) {
  try {
    const subdomain = req.headers['x-tenant-subdomain'] as string | undefined;
    if (subdomain) {
      const tenant = await findTenantBySubdomain(subdomain);
      if (tenant && (tenant.status === 'active' || tenant.status === 'trial')) {
        req.tenant = tenant;
      }
      return next();
    }

    if (process.env.NODE_ENV !== 'production') {
      const tenantId = req.headers['x-tenant-id'] as string | undefined;
      if (tenantId) {
        const tenant = await findTenantById(tenantId);
        if (tenant && (tenant.status === 'active' || tenant.status === 'trial')) {
          req.tenant = tenant;
        }
        return next();
      }

      const tenant = await findTenantBySubdomain('dok');
      if (tenant) req.tenant = tenant;
    }

    next();
  } catch (err) {
    console.error('tenantResolver error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
