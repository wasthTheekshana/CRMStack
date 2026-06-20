import { Request, Response, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
import { findUserByUsernameInTenant, updateLastLogin } from '../models/userModel';
import { findTenantById } from '../models/tenantModel';
import { query } from '../config/db';
import { createResetToken, findValidToken, claimToken } from '../models/resetTokenModel';
import { sendPasswordResetEmail } from '../services/emailService';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  if (username.length > 254 || password.length > 128) {
    res.status(400).json({ error: 'Invalid credentials' });
    return;
  }

  try {
    // Tenant users must log in via their subdomain (e.g. acme.crmstack.site).
    // nginx sets X-Tenant-Subdomain only on subdomain requests; absence means the
    // request came through the root domain — reject it to prevent cross-tenant access.
    const hasSubdomainHeader = !!(req.headers['x-tenant-subdomain'] as string)?.trim();
    if (!hasSubdomainHeader) {
      res.status(403).json({ error: 'Please log in via your company subdomain' });
      return;
    }
    if (!req.tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const user = await findUserByUsernameInTenant(username, req.tenant.id);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.tenant_id) {
      res.status(403).json({ error: 'User is not associated with a tenant' });
      return;
    }

    const tenant = req.tenant ?? await findTenantById(user.tenant_id);
    if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) {
      res.status(403).json({ error: 'Tenant is inactive or suspended' });
      return;
    }

    await updateLastLogin(user.id);

    const token = jwt.sign(
      {
        userId:   user.id,
        tenantId: tenant.id,
        role:     user.role,
        email:    user.email,
        plan:     tenant.plan,
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    // M7: Set token in httpOnly cookie (not exposed to JS)
    res.cookie('auth_token', token, AUTH_COOKIE_OPTIONS);

    res.json({
      user: {
        id:           user.id,
        email:        user.email,
        username:     user.username,
        displayName:  user.display_name,
        role:         user.role,
        tenantId:     tenant.id,
        plan:         tenant.plan,
        trialEndsAt:  tenant.trialEndsAt ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('auth_token').json({ message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  // M7: Accept token from httpOnly cookie or Bearer header
  const token = req.cookies?.auth_token ?? (() => {
    const h = req.headers.authorization;
    return h?.startsWith('Bearer ') ? h.split(' ')[1] : null;
  })();

  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; tenantId: string; plan: string };
    const [userResult, tenantResult] = await Promise.all([
      query(
        'SELECT id, email, username, display_name, role, is_active, tenant_id FROM users WHERE id = $1',
        [payload.userId]
      ),
      query('SELECT trial_ends_at FROM tenants WHERE id = $1', [payload.tenantId]),
    ]);
    const user = userResult.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id:          user.id,
      email:       user.email,
      username:    user.username,
      displayName: user.display_name,
      role:        user.role,
      isActive:    user.is_active,
      tenantId:    payload.tenantId,
      plan:        payload.plan,
      trialEndsAt: tenantResult.rows[0]?.trial_ends_at ?? null,
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const SUCCESS = { message: 'If that email is registered, you will receive a reset link shortly.' };

  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    res.json(SUCCESS);
    return;
  }

  try {
    const result = await query(
      'SELECT id, email, tenant_id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = result.rows[0];
    if (!user) { res.json(SUCCESS); return; }

    const tenant = await findTenantById(user.tenant_id);
    if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) { res.json(SUCCESS); return; }

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      console.error('APP_BASE_URL is not configured');
      res.status(500).json({ error: 'Failed to send email. Please try again.' });
      return;
    }

    const rawToken = await createResetToken(user.id);
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (smtpErr) {
      console.error('SMTP error:', smtpErr);
      res.status(500).json({ error: 'Failed to send email. Please try again.' });
      return;
    }

    res.json(SUCCESS);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function verifyResetToken(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token required' });
    return;
  }
  try {
    const found = await findValidToken(token);
    if (!found) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [found.userId]
    );
    const tenant = userResult.rows[0]?.tenant_id
      ? await findTenantById(userResult.rows[0].tenant_id)
      : null;
    if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    res.json({ valid: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and newPassword required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (newPassword.length > 128) {
    res.status(400).json({ error: 'Password must be at most 128 characters' });
    return;
  }
  try {
    const found = await claimToken(token);
    if (!found) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [found.userId]
    );
    const tenant = userResult.rows[0]?.tenant_id
      ? await findTenantById(userResult.rows[0].tenant_id)
      : null;
    if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, found.userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
