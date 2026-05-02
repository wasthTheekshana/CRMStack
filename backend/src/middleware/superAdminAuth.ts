import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface SAPayload {
  adminId: string;
  role:    'superadmin';
  email:   string;
}

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SAPayload;
    }
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  // M7: Read SA token from httpOnly cookie first, fall back to Bearer header
  const token = req.cookies?.sa_auth_token ?? (() => {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  })();

  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.SA_JWT_SECRET!) as SAPayload;
    if (payload.role !== 'superadmin') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    req.superAdmin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
