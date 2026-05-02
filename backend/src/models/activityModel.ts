import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapActivity = (row: Record<string, unknown>) => ({
  id:          row.id,
  leadId:      row.lead_id,
  type:        row.type,
  description: row.description,
  metadata:    row.metadata,
  ownerId:     row.owner_id,
  tenantId:    row.tenant_id,
  createdAt:   row.created_at,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllActivities(userId: string, tenantId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query(
        'SELECT * FROM activities WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100',
        [tenantId]
      )
    : await query(
        'SELECT * FROM activities WHERE tenant_id = $1 AND owner_id = $2 ORDER BY created_at DESC LIMIT 100',
        [tenantId, userId]
      );
  return result.rows.map(mapActivity);
}

export async function findActivitiesByLead(leadId: string, tenantId: string) {
  const result = await query(
    'SELECT * FROM activities WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
    [leadId, tenantId]
  );
  return result.rows.map(mapActivity);
}

export async function createActivity(data: {
  leadId:      string | null;
  type:        string;
  description: string;
  metadata:    unknown;
  ownerId:     string;
  tenantId:    string;
}) {
  const result = await query(
    `INSERT INTO activities (lead_id, type, description, metadata, owner_id, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      data.leadId,
      data.type,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.ownerId,
      data.tenantId,
    ]
  );
  return mapActivity(result.rows[0]);
}
