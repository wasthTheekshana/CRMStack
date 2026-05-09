import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  findAllUsers,
  findSalesUsers,
  findUserById,
  findUserByIdInTenant,
  mapUser,
} from '../models/userModel';
import { pool, query } from '../config/db';
import {
  notifyTeamMemberAdded,
  notifyUserDeactivated,
} from '../services/notificationService';

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await findAllUsers(req.user!.tenantId);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listSalesUsers(req: Request, res: Response) {
  try {
    const users = await findSalesUsers(req.user!.tenantId);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    // H7: scope to caller's tenant to prevent cross-tenant user enumeration
    const user = await findUserByIdInTenant(req.params.id, req.user!.tenantId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createUserHandler(req: Request, res: Response) {
  const { email, username, displayName, password, role } = req.body;
  if (!email || !username || !displayName || !password) {
    res.status(400).json({ error: 'email, username, displayName, password required' });
    return;
  }
  // Hash before acquiring the DB lock — bcrypt is CPU-bound, not DB-bound
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock tenant row so concurrent requests can't both pass the seat check
    const tenantResult = await client.query(
      'SELECT plan, user_limit FROM tenants WHERE id = $1 FOR UPDATE',
      [req.user!.tenantId]
    );
    if (!tenantResult.rows[0]) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Tenant not found' });
      return;
    }
    const { plan, user_limit } = tenantResult.rows[0];
    if (plan !== 'enterprise') {
      const countResult = await client.query(
        'SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = TRUE',
        [req.user!.tenantId]
      );
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= user_limit) {
        await client.query('ROLLBACK');
        res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          message: `Your plan allows ${user_limit} users. Contact support to add more licences.`,
          currentCount,
          limit: user_limit,
        });
        return;
      }
    }
    const insertResult = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1, LOWER($2), $3, $4, $5, $6)
       RETURNING id, email, username, display_name, role, is_active, tenant_id, created_at`,
      [email, username, displayName, passwordHash, role || 'sales', req.user!.tenantId]
    );
    const createdUser = mapUser(insertResult.rows[0]);
    await client.query('COMMIT');

    const adminResult = await query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
      [req.user!.tenantId]
    );
    const adminIds = adminResult.rows.map((r: { id: string }) => r.id);
    void notifyTeamMemberAdded({
      tenantId:     req.user!.tenantId,
      adminIds,
      newUserName:  createdUser.displayName as string,
      newUserEmail: createdUser.email as string,
    });

    res.status(201).json(createdUser);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const pg = err as { code?: string };
    if (pg.code === '23505') { res.status(409).json({ error: 'Email or username already exists' }); return; }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

export async function updateUserHandler(req: Request, res: Response) {
  const { displayName, email, role, isActive, password } = req.body;
  // Hash before acquiring the DB lock — bcrypt is CPU-bound, not DB-bound
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify target user exists and belongs to the requester's tenant
    const userResult = await client.query(
      'SELECT id, is_active, tenant_id FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!userResult.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const targetUser = userResult.rows[0];
    if (targetUser.tenant_id !== req.user!.tenantId) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    // Seat limit check — only when re-activating a currently-inactive user
    if (isActive === true && !targetUser.is_active) {
      const tenantResult = await client.query(
        'SELECT plan, user_limit FROM tenants WHERE id = $1 FOR UPDATE',
        [req.user!.tenantId]
      );
      const { plan, user_limit } = tenantResult.rows[0];
      if (plan !== 'enterprise') {
        const countResult = await client.query(
          'SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = TRUE',
          [req.user!.tenantId]
        );
        const currentCount = parseInt(countResult.rows[0].count, 10);
        if (currentCount >= user_limit) {
          await client.query('ROLLBACK');
          res.status(403).json({
            error: 'USER_LIMIT_REACHED',
            message: `Your plan allows ${user_limit} users. Contact support to add more licences.`,
            currentCount,
            limit: user_limit,
          });
          return;
        }
      }
    }
    // Check email uniqueness within tenant (excluding current user)
    if (email) {
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND tenant_id = $2 AND id != $3',
        [email, req.user!.tenantId, req.params.id]
      );
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
    }
    if (passwordHash) {
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.params.id]);
    }
    const updateResult = await client.query(
      `UPDATE users
         SET display_name = COALESCE($1, display_name),
             email        = COALESCE($2, email),
             role         = COALESCE($3, role),
             is_active    = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING id, email, username, display_name, role, is_active, tenant_id`,
      [displayName ?? null, email ?? null, role ?? null, isActive ?? null, req.params.id]
    );
    const updatedUser = mapUser(updateResult.rows[0]);
    await client.query('COMMIT');

    if (isActive === false && targetUser.is_active === true) {
      const adminResult = await query(
        `SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
        [req.user!.tenantId]
      );
      const adminIds = adminResult.rows.map((r: { id: string }) => r.id);
      void notifyUserDeactivated({
        tenantId: req.user!.tenantId,
        adminIds,
        userName: updatedUser.displayName as string,
      });
    }

    res.json(updatedUser);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}
