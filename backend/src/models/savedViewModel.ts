import { query } from '../config/db'

export interface SavedView {
  id:        string
  tenantId:  string
  userId:    string
  name:      string
  filters:   Record<string, unknown>
  createdAt: string
}

const mapRow = (r: Record<string, unknown>): SavedView => ({
  id:        r.id        as string,
  tenantId:  r.tenant_id as string,
  userId:    r.user_id   as string,
  name:      r.name      as string,
  filters:   (r.filters  as Record<string, unknown>) ?? {},
  createdAt: r.created_at as string,
})

export async function findSavedViews(tenantId: string, userId: string): Promise<SavedView[]> {
  const result = await query(
    `SELECT * FROM saved_views
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at ASC`,
    [tenantId, userId]
  )
  return result.rows.map(mapRow)
}

export async function createSavedView(data: {
  tenantId: string
  userId:   string
  name:     string
  filters:  Record<string, unknown>
}): Promise<SavedView> {
  const result = await query(
    `INSERT INTO saved_views (tenant_id, user_id, name, filters)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.tenantId, data.userId, data.name, JSON.stringify(data.filters)]
  )
  return mapRow(result.rows[0])
}

export async function deleteSavedView(id: string, userId: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM saved_views WHERE id = $1 AND user_id = $2 AND tenant_id = $3',
    [id, userId, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}
