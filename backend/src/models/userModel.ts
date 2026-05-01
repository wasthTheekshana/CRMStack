import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapUser = (u: Record<string, unknown>) => ({
  id:          u.id,
  uid:         u.id,   // alias for frontend compatibility
  email:       u.email,
  username:    u.username,
  displayName: u.display_name,
  role:        u.role,
  isActive:    u.is_active,
  tenantId:    u.tenant_id,
  createdAt:   u.created_at,
  lastLoginAt: u.last_login_at,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllUsers(tenantId: string) {
  const result = await query(
    `SELECT id, email, username, display_name, role, is_active, tenant_id, created_at, last_login_at
     FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`,
    [tenantId]
  );
  return result.rows.map(mapUser);
}

export async function findSalesUsers(tenantId: string) {
  const result = await query(
    `SELECT id, email, username, display_name FROM users
     WHERE role = 'sales' AND is_active = TRUE AND tenant_id = $1
     ORDER BY display_name`,
    [tenantId]
  );
  return result.rows.map(mapUser);
}

export async function findUserById(id: string) {
  const result = await query(
    'SELECT id, email, username, display_name, role, is_active, tenant_id, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByIdInTenant(id: string, tenantId: string) {
  const result = await query(
    `SELECT id, email, username, display_name, role, is_active, tenant_id, created_at
     FROM users WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByUsername(username: string) {
  const result = await query(
    `SELECT * FROM users
     WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
       AND is_active = TRUE
     LIMIT 1`,
    [username]
  );
  return result.rows[0] ?? null;
}

export async function createUser(data: {
  email:        string;
  username:     string;
  displayName:  string;
  passwordHash: string;
  role:         string;
  tenantId:     string;
}) {
  const result = await query(
    `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
     VALUES ($1, LOWER($2), $3, $4, $5, $6)
     RETURNING id, email, username, display_name, role, is_active, tenant_id, created_at`,
    [data.email, data.username, data.displayName, data.passwordHash, data.role, data.tenantId]
  );
  return mapUser(result.rows[0]);
}

export async function updateUser(id: string, data: {
  displayName?: string;
  role?:        string;
  isActive?:    boolean;
}) {
  const result = await query(
    `UPDATE users
        SET display_name = COALESCE($1, display_name),
            role         = COALESCE($2, role),
            is_active    = COALESCE($3, is_active)
      WHERE id = $4
  RETURNING id, email, username, display_name, role, is_active, tenant_id`,
    [data.displayName, data.role, data.isActive, id]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateUserPassword(id: string, passwordHash: string) {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
}

export async function updateLastLogin(id: string) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function findUserByEmailInTenant(
  email: string,
  tenantId: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  const result = await query(
    `SELECT id, email, display_name
     FROM users
     WHERE LOWER(email) = LOWER($1)
       AND tenant_id = $2
       AND is_active = TRUE`,
    [email.trim(), tenantId]
  );
  return result.rows[0] ? {
    id:          result.rows[0].id as string,
    email:       result.rows[0].email as string,
    displayName: result.rows[0].display_name as string,
  } : null;
}

export async function findAdminsByTenant(tenantId: string) {
  const result = await query(
    `SELECT id, email, display_name FROM users
     WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
    [tenantId]
  );
  return result.rows as { id: string; email: string; display_name: string }[];
}
