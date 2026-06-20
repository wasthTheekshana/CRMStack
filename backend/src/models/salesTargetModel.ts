import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapTarget = (row: Record<string, unknown>) => ({
  id:          row.id,
  year:        row.year,
  month:       row.month,
  target:      parseFloat(row.target as string),
  achievement: parseFloat(row.achievement as string),
  ownerId:     row.owner_id,
  ownerEmail:  row.owner_email,
  ownerName:   row.owner_name,
  tenantId:    row.tenant_id,
  createdAt:   row.created_at,
  updatedAt:   row.updated_at,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllTargets(userId: string, tenantId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query(
        'SELECT * FROM sales_targets WHERE tenant_id = $1 ORDER BY year DESC, month DESC',
        [tenantId]
      )
    : await query(
        'SELECT * FROM sales_targets WHERE tenant_id = $1 AND owner_id = $2 ORDER BY year DESC, month DESC',
        [tenantId, userId]
      );
  return result.rows.map(mapTarget);
}

export async function upsertTarget(data: {
  year:        number;
  month:       number;
  target:      number;
  achievement: number;
  ownerId:     string;
  ownerEmail:  string;
  ownerName:   string;
  tenantId:    string;
}) {
  const result = await query(
    `INSERT INTO sales_targets (year, month, target, achievement, owner_id, owner_email, owner_name, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (year, month, owner_id) DO UPDATE
       SET target = $3, achievement = $4, updated_at = NOW()
     RETURNING *`,
    [data.year, data.month, data.target, data.achievement, data.ownerId, data.ownerEmail, data.ownerName, data.tenantId]
  );
  return mapTarget(result.rows[0]);
}

// ownerId = undefined → admin, can update any target in the tenant
// ownerId = userId    → non-admin, can only update their own target
export async function updateTarget(id: string, tenantId: string, data: {
  target?:      number;
  achievement?: number;
}, ownerId?: string) {
  const ownerFilter = ownerId ? 'AND owner_id = $5' : '';
  const params: unknown[] = [data.target, data.achievement, id, tenantId];
  if (ownerId) params.push(ownerId);
  const result = await query(
    `UPDATE sales_targets SET
       target      = COALESCE($1, target),
       achievement = COALESCE($2, achievement)
     WHERE id = $3 AND tenant_id = $4 ${ownerFilter} RETURNING *`,
    params
  );
  return result.rows[0] ? mapTarget(result.rows[0]) : null;
}

export async function removeTarget(id: string, tenantId: string) {
  await query('DELETE FROM sales_targets WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}
