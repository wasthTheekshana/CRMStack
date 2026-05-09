import { query } from '../config/db';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Tenant {
  id:           string;
  name:         string;
  subdomain:    string;
  plan:         'starter' | 'business' | 'enterprise';
  status:       'active' | 'trial' | 'suspended' | 'cancelled';
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
  name?:              string;
  plan?:              string;
  status?:            string;
  userLimit?:         number;
  ownerEmail?:        string;
  trialEndsAt?:       Date | string | null;
  resetTrialNotified?: boolean;
}): Promise<Tenant | null> {
  const result = await query(
    `UPDATE tenants SET
       name        = COALESCE($1, name),
       plan        = COALESCE($2, plan),
       status      = COALESCE($3, status),
       user_limit  = COALESCE($4, user_limit),
       owner_email = COALESCE($5, owner_email),
       trial_ends_at = CASE WHEN $6::text IS NOT NULL THEN $6::timestamptz ELSE trial_ends_at END,
       trial_notified_7d = CASE WHEN $7 THEN FALSE ELSE trial_notified_7d END,
       trial_notified_5d = CASE WHEN $7 THEN FALSE ELSE trial_notified_5d END,
       trial_notified_2d = CASE WHEN $7 THEN FALSE ELSE trial_notified_2d END,
       suspended_at = CASE WHEN $3 = 'suspended' AND suspended_at IS NULL THEN NOW()
                          WHEN $3 IS NOT NULL AND $3 != 'suspended' THEN NULL
                          ELSE suspended_at END
     WHERE id = $8
     RETURNING *`,
    [data.name ?? null, data.plan ?? null, data.status ?? null, data.userLimit ?? null,
     data.ownerEmail ?? null, data.trialEndsAt !== undefined ? data.trialEndsAt : null,
     data.resetTrialNotified ?? false, id]
  );
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}

export async function clearTrialEndsAt(id: string): Promise<void> {
  await query(
    `UPDATE tenants SET trial_ends_at = NULL,
       trial_notified_7d = FALSE, trial_notified_5d = FALSE, trial_notified_2d = FALSE
     WHERE id = $1`,
    [id]
  );
}

export async function markTrialNotified(id: string, interval: '7d' | '5d' | '2d'): Promise<void> {
  const col = interval === '7d' ? 'trial_notified_7d'
            : interval === '5d' ? 'trial_notified_5d'
            : 'trial_notified_2d';
  await query(`UPDATE tenants SET ${col} = TRUE WHERE id = $1`, [id]);
}

export interface TrialTenantRow {
  id:              string;
  name:            string;
  ownerEmail:      string;
  trialEndsAt:     Date;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
}

export async function findExpiringTrialTenants(): Promise<TrialTenantRow[]> {
  const result = await query(`
    SELECT id, name, owner_email, trial_ends_at,
           trial_notified_7d, trial_notified_5d, trial_notified_2d
    FROM tenants
    WHERE status = 'trial'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= NOW() + INTERVAL '8 days'
  `);
  return result.rows.map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    name:        r.name as string,
    ownerEmail:  r.owner_email as string,
    trialEndsAt: r.trial_ends_at as Date,
    notified7d:  r.trial_notified_7d as boolean,
    notified5d:  r.trial_notified_5d as boolean,
    notified2d:  r.trial_notified_2d as boolean,
  }));
}

export async function countUsersInTenant(tenantId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = TRUE',
    [tenantId]
  );
  return parseInt(result.rows[0].count);
}
