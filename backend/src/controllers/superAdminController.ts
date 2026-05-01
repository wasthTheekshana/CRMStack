import { Request, Response } from 'express';
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findAdminByEmail, updateAdminLastLogin } from '../models/dokAdminModel';
import { query, pool } from '../config/db';

// ─── Handler 1: login ────────────────────────────────────────────────────────

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  try {
    const admin = await findAdminByEmail(email);
    if (!admin) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    await updateAdminLastLogin(admin.id);
    const token = jwt.sign(
      { adminId: admin.id, role: 'superadmin', email: admin.email },
      process.env.SA_JWT_SECRET!,
      { expiresIn: '12h' }
    );
    res.json({ token, admin: { adminId: admin.id, email: admin.email, displayName: admin.displayName } });
  } catch (err) {
    console.error('SA login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 2: getStats ─────────────────────────────────────────────────────

export async function getStats(_req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')    AS active_tenants,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_tenants,
        COUNT(*) FILTER (WHERE trial_ends_at > NOW() AND status = 'active') AS trial_tenants,
        COUNT(*) AS total_tenants
      FROM tenants
    `);
    const userResult = await query(`SELECT COUNT(*) AS total_users FROM users`);
    const newThisMonthResult = await query(`
      SELECT COUNT(*) AS new_this_month FROM tenants
      WHERE created_at >= date_trunc('month', NOW())
    `);
    const planResult = await query(`
      SELECT plan, COUNT(*) AS count FROM tenants WHERE status = 'active' GROUP BY plan
    `);
    const planCounts: Record<string, number> = {};
    planResult.rows.forEach((r: Record<string, unknown>) => { planCounts[r.plan as string] = Number(r.count); });
    const PLAN_PRICE: Record<string, number> = { starter: 99, business: 249, enterprise: 599 };
    const estimatedMRR = Object.entries(planCounts).reduce(
      (sum, [plan, count]) => sum + (PLAN_PRICE[plan] || 0) * count, 0
    );
    res.json({
      activeTenants:    Number(result.rows[0].active_tenants),
      suspendedTenants: Number(result.rows[0].suspended_tenants),
      trialTenants:     Number(result.rows[0].trial_tenants),
      totalTenants:     Number(result.rows[0].total_tenants),
      totalUsers:       Number(userResult.rows[0].total_users),
      newThisMonth:     Number(newThisMonthResult.rows[0].new_this_month),
      planCounts,
      estimatedMRR,
    });
  } catch (err) {
    console.error('SA getStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 3: listTenants ──────────────────────────────────────────────────

export async function listTenants(_req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT t.id, t.name, t.subdomain, t.plan, t.status, t.user_limit,
             t.owner_email, t.created_at, t.trial_ends_at,
             COUNT(DISTINCT u.id) AS user_count,
             COUNT(DISTINCT l.id) AS lead_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN leads l ON l.tenant_id = t.id AND l.is_deleted = FALSE
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows.map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, subdomain: r.subdomain, plan: r.plan,
      status: r.status, userLimit: Number(r.user_limit), ownerEmail: r.owner_email,
      createdAt: r.created_at, trialEndsAt: r.trial_ends_at,
      userCount: Number(r.user_count), leadCount: Number(r.lead_count),
    })));
  } catch (err) {
    console.error('SA listTenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 4: createTenant ─────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(randomInt(0, chars.length));
  }
  return password;
}

export async function createTenant(req: Request, res: Response) {
  const { name, subdomain, plan = 'starter', userLimit = 3, trialEndsAt = null, adminName, adminEmail } = req.body;
  if (!name || !subdomain || !adminName || !adminEmail) {
    res.status(400).json({ error: 'name, subdomain, adminName, adminEmail are required' });
    return;
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
      [name, subdomain.toLowerCase().trim(), plan, userLimit, adminEmail]
    );
    const tenant = tenantResult.rows[0];
    if (trialEndsAt) {
      await client.query('UPDATE tenants SET trial_ends_at = $1 WHERE id = $2', [trialEndsAt, tenant.id]);
    }
    const username = adminEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    await client.query(
      `INSERT INTO users (tenant_id, email, username, display_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)`,
      [tenant.id, adminEmail.toLowerCase().trim(), username, adminName, passwordHash]
    );
    await client.query(
      `INSERT INTO tenant_configs (tenant_id, sales_stages, solutions, custom_fields, visible_fields, branding)
       VALUES ($1,
         '[{"id":"s1","name":"On Hold","color":"#F97316","probability":10,"order":0,"isWon":false},{"id":"s2","name":"Meeting Pending","color":"#3B82F6","probability":25,"order":1,"isWon":false},{"id":"s3","name":"Proposal Sent","color":"#8B5CF6","probability":50,"order":2,"isWon":false},{"id":"s4","name":"Negotiated","color":"#A855F7","probability":75,"order":3,"isWon":false},{"id":"s5","name":"Verbal Yes","color":"#EC4899","probability":90,"order":4,"isWon":false},{"id":"s6","name":"Closed & Won","color":"#22C55E","probability":100,"order":5,"isWon":true}]'::jsonb,
         '[{"id":"p1","name":"Document Management"},{"id":"p2","name":"Digital Archiving"},{"id":"p3","name":"Workflow Automation"}]'::jsonb,
         '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [tenant.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, plan: tenant.plan }, adminEmail, tempPassword });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('SA createTenant error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message.includes('unique') || message.includes('duplicate')) {
      res.status(409).json({ error: 'Subdomain or email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    client.release();
  }
}

// ─── Handler 5: getTenantDetail ──────────────────────────────────────────────

export async function getTenantDetail(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (!tenantResult.rows.length) { res.status(404).json({ error: 'Tenant not found' }); return; }
    const tenant = tenantResult.rows[0];
    const usersResult = await query(
      `SELECT id, email, username, display_name, role, is_active, last_login_at, created_at
       FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`, [id]
    );
    const statsResult = await query(
      `SELECT COUNT(DISTINCT l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count,
              COUNT(DISTINCT a.id) AS activity_count
       FROM tenants t
       LEFT JOIN leads l ON l.tenant_id = t.id
       LEFT JOIN activities a ON a.tenant_id = t.id
       WHERE t.id = $1`, [id]
    );
    const configResult = await query(
      'SELECT sales_stages, solutions FROM tenant_configs WHERE tenant_id = $1', [id]
    );
    const config = configResult.rows[0] || null;
    res.json({
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, plan: tenant.plan,
                status: tenant.status, userLimit: tenant.user_limit, ownerEmail: tenant.owner_email,
                createdAt: tenant.created_at, trialEndsAt: tenant.trial_ends_at },
      users: usersResult.rows.map((u: Record<string, unknown>) => ({
        id: u.id, email: u.email, username: u.username, displayName: u.display_name,
        role: u.role, isActive: u.is_active, lastLoginAt: u.last_login_at, createdAt: u.created_at,
      })),
      stats: {
        leadCount:     Number(statsResult.rows[0]?.lead_count ?? 0),
        activityCount: Number(statsResult.rows[0]?.activity_count ?? 0),
      },
      config: config ? {
        stageNames:    (config.sales_stages as Array<{name: string}>).map(s => s.name),
        solutionNames: (config.solutions    as Array<{name: string}>).map(s => s.name),
      } : null,
    });
  } catch (err) {
    console.error('SA getTenantDetail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 6: updateTenant ─────────────────────────────────────────────────

export async function updateTenant(req: Request, res: Response) {
  const { id } = req.params;
  const { plan, userLimit, status } = req.body;
  const VALID_STATUSES = ['active', 'suspended', 'trial', 'cancelled'];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }
  const updates: string[] = [];
  const values:  unknown[] = [];
  let idx = 1;
  if (plan !== undefined)      { updates.push(`plan = $${idx++}`);       values.push(plan); }
  if (userLimit !== undefined) { updates.push(`user_limit = $${idx++}`); values.push(userLimit); }
  if (status !== undefined) {
    updates.push(`status = $${idx++}`); values.push(status);
    updates.push(status === 'suspended' ? `suspended_at = NOW()` : `suspended_at = NULL`);
  }
  if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
  values.push(id);
  try {
    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!result.rows.length) { res.status(404).json({ error: 'Tenant not found' }); return; }
    const t = result.rows[0];
    res.json({ id: t.id, name: t.name, subdomain: t.subdomain, plan: t.plan, status: t.status, userLimit: t.user_limit });
  } catch (err) {
    console.error('SA updateTenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 7: exportTenantCSV ──────────────────────────────────────────────

export async function exportTenantCSV(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const tenantResult = await query('SELECT name, subdomain FROM tenants WHERE id = $1', [id]);
    if (!tenantResult.rows.length) { res.status(404).json({ error: 'Tenant not found' }); return; }
    const subdomain = tenantResult.rows[0].subdomain as string;
    const usersResult = await query(
      `SELECT email, display_name, role, is_active, created_at, last_login_at FROM users WHERE tenant_id = $1`, [id]
    );
    const leadsResult = await query(
      `SELECT company_name, contact_name, contact_number, solution, sales_stage,
              estimated_revenue, probability, remarks, created_at
       FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC`, [id]
    );
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push('USERS');
    lines.push('Email,Name,Role,Active,Created,Last Login');
    usersResult.rows.forEach((u: Record<string, unknown>) => {
      lines.push([u.email, u.display_name, u.role, u.is_active, u.created_at, u.last_login_at].map(escape).join(','));
    });
    lines.push('');
    lines.push('LEADS');
    lines.push('Company,Contact,Phone,Solution,Stage,Revenue,Probability,Remarks,Created');
    leadsResult.rows.forEach((l: Record<string, unknown>) => {
      lines.push([l.company_name, l.contact_name, l.contact_number, l.solution, l.sales_stage,
                  l.estimated_revenue, l.probability, l.remarks, l.created_at].map(escape).join(','));
    });
    const csv = lines.join('\n');
    const filename = `${subdomain}-export-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('SA exportTenantCSV error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 8: deleteTenant ─────────────────────────────────────────────────

export async function deleteTenant(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM tenants WHERE id = $1 RETURNING id, name, subdomain', [id]);
    if (!result.rows.length) { res.status(404).json({ error: 'Tenant not found' }); return; }
    res.json({ deleted: true, tenant: result.rows[0] });
  } catch (err) {
    console.error('SA deleteTenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 9: searchUsers ──────────────────────────────────────────────────

export async function searchUsers(req: Request, res: Response) {
  const { email } = req.query as { email?: string };
  if (!email || email.trim().length < 2) {
    res.status(400).json({ error: 'email query param required (min 2 chars)' }); return;
  }
  try {
    const result = await query(
      `SELECT u.id, u.email, u.display_name, u.role, u.is_active, u.last_login_at, u.created_at,
              t.name AS tenant_name, t.subdomain, t.id AS tenant_id
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email ILIKE $1
       ORDER BY u.created_at DESC LIMIT 50`,
      [`%${email.trim()}%`]
    );
    res.json(result.rows.map((r: Record<string, unknown>) => ({
      id: r.id, email: r.email, displayName: r.display_name, role: r.role,
      isActive: r.is_active, lastLoginAt: r.last_login_at, createdAt: r.created_at,
      tenantId: r.tenant_id, tenantName: r.tenant_name, subdomain: r.subdomain,
    })));
  } catch (err) {
    console.error('SA searchUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Handler 10: resetUserPassword ──────────────────────────────────────────

export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 6) {
    res.status(400).json({ error: 'tempPassword required (min 6 chars)' }); return;
  }
  try {
    const userCheck = await query(
      `SELECT role FROM users WHERE id = $1`,
      [id]
    );
    if (!userCheck.rows.length) {
      res.status(404).json({ error: 'User not found' }); return;
    }
    if (userCheck.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Password can only be changed for admin users' }); return;
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, display_name`,
      [passwordHash, id]
    );
    res.json({ updated: true, userId: result.rows[0].id, email: result.rows[0].email,
               displayName: result.rows[0].display_name });
  } catch (err) {
    console.error('SA resetUserPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
