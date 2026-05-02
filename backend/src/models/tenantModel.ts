import { query } from '../config/db';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Tenant {
  id:           string;
  name:         string;
  subdomain:    string;
  plan:         'starter' | 'business' | 'enterprise';
  status:       'active' | 'suspended' | 'cancelled';
  userLimit:    number;
  ownerEmail:   string;
  createdAt:    Date;
  suspendedAt:  Date | null;
  trialEndsAt:  Date | null;
}

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapTenant = (row: Record<string, unknown>): Tenant => ({
  id:          row.id as string,
  name:        row.name as string,
  subdomain:   row.subdomain as string,
  plan:        row.plan as Tenant['plan'],
  status:      row.status as Tenant['status'],
  userLimit:   row.user_limit as number,
  ownerEmail:  row.owner_email as string,
  createdAt:   row.created_at as Date,
  suspendedAt: row.suspended_at as Date | null,
  trialEndsAt: row.trial_ends_at as Date | null,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  const result = await query(
    'SELECT * FROM tenants WHERE subdomain = $1',
    [subdomain]
  );
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  const result = await query(
    'SELECT * FROM tenants WHERE id = $1',
    [id]
  );
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}

export async function findAllTenants(): Promise<Tenant[]> {
  const result = await query(
    'SELECT * FROM tenants ORDER BY created_at ASC'
  );
  return result.rows.map(mapTenant);
}

export async function createTenant(data: {
  name:       string;
  subdomain:  string;
  plan:       string;
  userLimit:  number;
  ownerEmail: string;
}): Promise<Tenant> {
  const result = await query(
    `INSERT INTO tenants (name, subdomain, plan, user_limit, owner_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.name, data.subdomain, data.plan, data.userLimit, data.ownerEmail]
  );
  return mapTenant(result.rows[0]);
}

export async function updateTenant(id: string, data: {
  name?:       string;
  plan?:       string;
  status?:     string;
  userLimit?:  number;
  ownerEmail?: string;
}): Promise<Tenant | null> {
  const result = await query(
    `UPDATE tenants SET
       name        = COALESCE($1, name),
       plan        = COALESCE($2, plan),
       status      = COALESCE($3, status),
       user_limit  = COALESCE($4, user_limit),
       owner_email = COALESCE($5, owner_email),
       suspended_at = CASE WHEN $3 = 'suspended' AND suspended_at IS NULL THEN NOW()
                          WHEN $3 != 'suspended' THEN NULL
                          ELSE suspended_at END
     WHERE id = $6
     RETURNING *`,
    [data.name, data.plan, data.status, data.userLimit, data.ownerEmail, id]
  );
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}

export async function countUsersInTenant(tenantId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = TRUE',
    [tenantId]
  );
  return parseInt(result.rows[0].count);
}
