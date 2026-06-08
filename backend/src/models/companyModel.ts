import { query } from '../config/db'

export interface Company {
  id:        string
  tenantId:  string
  ownerId:   string
  name:      string
  website:   string | null
  phone:     string | null
  address:   string | null
  notes:     string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  deletedAt: string | null
  leadCount?: number
}

const mapRow = (r: Record<string, unknown>): Company => ({
  id:        r.id         as string,
  tenantId:  r.tenant_id  as string,
  ownerId:   r.owner_id   as string,
  name:      r.name       as string,
  website:   (r.website   as string) ?? null,
  phone:     (r.phone     as string) ?? null,
  address:   (r.address   as string) ?? null,
  notes:     (r.notes     as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  isDeleted: r.is_deleted as boolean,
  deletedAt: (r.deleted_at as string) ?? null,
  leadCount: r.lead_count !== undefined ? parseInt(r.lead_count as string, 10) : undefined,
})

// ownerId = undefined → admin, sees all companies in the tenant
// ownerId = userId    → non-admin, sees only their own
export async function findAllCompanies(tenantId: string, ownerId?: string): Promise<Company[]> {
  const ownerFilter = ownerId ? 'AND c.owner_id = $2' : ''
  const params = ownerId ? [tenantId, ownerId] : [tenantId]
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.tenant_id = $1 ${ownerFilter}
        AND c.is_deleted = FALSE
      GROUP BY c.id
      ORDER BY c.name ASC`,
    params
  )
  return result.rows.map(mapRow)
}

export async function findCompanyById(id: string, tenantId: string, ownerId?: string): Promise<Company | null> {
  const ownerFilter = ownerId ? 'AND c.owner_id = $3' : ''
  const params = ownerId ? [id, tenantId, ownerId] : [id, tenantId]
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.id = $1 AND c.tenant_id = $2 ${ownerFilter}
        AND c.is_deleted = FALSE
      GROUP BY c.id`,
    params
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createCompany(data: {
  tenantId: string
  ownerId:  string
  name:     string
  website?: string | null
  phone?:   string | null
  address?: string | null
  notes?:   string | null
}): Promise<Company> {
  const result = await query(
    `INSERT INTO companies (tenant_id, owner_id, name, website, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.tenantId, data.ownerId, data.name,
     data.website ?? null, data.phone ?? null, data.address ?? null, data.notes ?? null]
  )
  return mapRow(result.rows[0])
}

export async function updateCompany(
  id: string, tenantId: string,
  data: { name?: string; website?: string | null; phone?: string | null; address?: string | null; notes?: string | null },
  ownerId?: string
): Promise<Company | null> {
  const ownerFilter = ownerId ? 'AND owner_id = $8' : ''
  const params: unknown[] = [data.name, data.website, data.phone, data.address, data.notes, id, tenantId]
  if (ownerId) params.push(ownerId)
  const result = await query(
    `UPDATE companies SET
       name       = COALESCE($1, name),
       website    = COALESCE($2, website),
       phone      = COALESCE($3, phone),
       address    = COALESCE($4, address),
       notes      = COALESCE($5, notes),
       updated_at = NOW()
     WHERE id = $6 AND tenant_id = $7 ${ownerFilter} AND is_deleted = FALSE
     RETURNING *`,
    params
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteCompany(id: string, tenantId: string, ownerId?: string): Promise<boolean> {
  const ownerFilter = ownerId ? 'AND owner_id = $3' : ''
  const params: string[] = [id, tenantId]
  if (ownerId) params.push(ownerId)
  const result = await query(
    `UPDATE companies SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND tenant_id = $2 ${ownerFilter} AND is_deleted = FALSE`,
    params
  )
  return (result.rowCount ?? 0) > 0
}

// Used when importing leads by name — scoped per user so each user's "Acme Corp" is independent
export async function findOrCreateCompany(tenantId: string, ownerId: string, name: string): Promise<Company> {
  const result = await query(
    `INSERT INTO companies (tenant_id, owner_id, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, owner_id, lower(name)) WHERE is_deleted = FALSE
     DO UPDATE SET updated_at = companies.updated_at
     RETURNING *`,
    [tenantId, ownerId, name]
  )
  return mapRow(result.rows[0])
}
