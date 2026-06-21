import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapActivity = (row: Record<string, unknown>) => ({
  id:          row.id,
  leadId:      row.lead_id,
  type:        row.type,
  description: row.description,
  metadata:    row.metadata,
  ownerId:     row.owner_id,
  ownerName:   row.owner_name as string | null,
  tenantId:    row.tenant_id,
  createdAt:   row.created_at,
});

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface ActivityFilters {
  ownerId?:   string;
  type?:      string;
  leadId?:    string;
  startDate?: string;
  endDate?:   string;
  limit?:     number;
}

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllActivities(
  userId: string,
  tenantId: string,
  isAdmin: boolean,
  filters: ActivityFilters = {}
) {
  const conditions: string[] = ['a.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let i = 2;

  // Non-admins are always restricted to their own activities, regardless of filters.
  if (!isAdmin) {
    conditions.push(`a.owner_id = $${i++}`); params.push(userId);
  } else if (filters.ownerId) {
    conditions.push(`a.owner_id = $${i++}`); params.push(filters.ownerId);
  }
  if (filters.type)      { conditions.push(`a.type = $${i++}`);        params.push(filters.type); }
  if (filters.leadId)    { conditions.push(`a.lead_id = $${i++}`);     params.push(filters.leadId); }
  if (filters.startDate) { conditions.push(`a.created_at >= $${i++}`); params.push(filters.startDate); }
  if (filters.endDate)   { conditions.push(`a.created_at <= $${i++}`); params.push(filters.endDate); }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);
  const limitPlaceholder = `$${i}`;
  // NOTE: `i` is intentionally not incremented further — it is unused after this point.
  // If you add another clause below, increment `i` when pushing its placeholder.

  const result = await query(
    `SELECT a.*, u.display_name AS owner_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.owner_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT ${limitPlaceholder}`,
    params
  );
  return result.rows.map(mapActivity);
}

export async function findActivitiesByLead(leadId: string, tenantId: string) {
  const result = await query(
    `SELECT a.*, u.display_name AS owner_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.owner_id
      WHERE a.lead_id = $1 AND a.tenant_id = $2
      ORDER BY a.created_at DESC`,
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
