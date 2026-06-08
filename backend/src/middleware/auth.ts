import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getTenantStatus } from '../models/tenantModel';

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
    const status = await getTenantStatus(payload.tenantId);
    if (status !== 'active' && status !== 'trial') {
      res.status(403).json({
        error: 'TENANT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      });
      return;
    }

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
