import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getTenantAccess } from '../models/tenantModel';
import { getUserAuthState } from '../models/userModel';

export interface AuthPayload {
  userId:   string;
  tenantId: string;
  role:     'admin' | 'sales';
  email:    string;
  plan:     string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // M7: Read token from httpOnly cookie first, fall back to Bearer header for API clients
  const token = req.cookies?.auth_token ?? (() => {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  })();

  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;

    if (req.tenant && payload.tenantId !== req.tenant.id) {
      res.status(403).json({ error: 'Token tenant mismatch' });
      return;
    }

    // Check tenant status directly from DB so suspension is enforced immediately,
    // regardless of whether resolveTenant ran (it doesn't run on API routes).
    const access = await getTenantAccess(payload.tenantId);
    if (!access || (access.status !== 'active' && access.status !== 'trial')) {
      res.status(403).json({
        error: 'TENANT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      });
      return;
    }

    // Trial expiry is enforced at request time; the daily job only flips the stored status.
    if (access.status === 'trial' && access.trialEndsAt && access.trialEndsAt < new Date()) {
      res.status(402).json({
        error: 'TRIAL_EXPIRED',
        message: 'Your trial has ended. Please contact support to upgrade your plan.',
      });
      return;
    }

    // Enforce account deactivation immediately: a deactivated user must not be
    // able to keep using a JWT that was issued before they were deactivated.
    // The role is also re-read from the database so a demotion takes effect immediately
    // instead of the stale role claim in the JWT staying valid until it expires.
    const userState = await getUserAuthState(payload.userId, payload.tenantId);
    if (!userState?.isActive) {
      res.status(403).json({ error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.' });
      return;
    }
    req.user = { ...payload, role: userState.role };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
