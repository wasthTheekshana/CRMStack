import { query } from '../config/db'

export interface Company {
  id:        string
  tenantId:  string
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
  id:        r.id        as string,
  tenantId:  r.tenant_id as string,
  name:      r.name      as string,
  website:   (r.website  as string) ?? null,
  phone:     (r.phone    as string) ?? null,
  address:   (r.address  as string) ?? null,
  notes:     (r.notes    as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  isDeleted: r.is_deleted as boolean,
  deletedAt: (r.deleted_at as string) ?? null,
  leadCount: r.lead_count !== undefined ? parseInt(r.lead_count as string, 10) : undefined,
})

export async function findAllCompanies(tenantId: string): Promise<Company[]> {
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.tenant_id = $1
        AND c.is_deleted = FALSE
      GROUP BY c.id
      ORDER BY c.name ASC`,
    [tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findCompanyById(id: string, tenantId: string): Promise<Company | null> {
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.id = $1 AND c.tenant_id = $2
      GROUP BY c.id`,
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createCompany(data: {
  tenantId: string
  name:     string
  website?: string | null
  phone?:   string | null
  address?: string | null
  notes?:   string | null
}): Promise<Company> {
  const result = await query(
    `INSERT INTO companies (tenant_id, name, website, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.tenantId, data.name, data.website ?? null, data.phone ?? null,
     data.address ?? null, data.notes ?? null]
  )
  return mapRow(result.rows[0])
}

export async function updateCompany(id: string, tenantId: string, data: {
  name?:    string
  website?: string | null
  phone?:   string | null
  address?: string | null
  notes?:   string | null
}): Promise<Company | null> {
  const result = await query(
    `UPDATE companies SET
       name       = COALESCE($1, name),
       website    = COALESCE($2, website),
       phone      = COALESCE($3, phone),
       address    = COALESCE($4, address),
       notes      = COALESCE($5, notes),
       updated_at = NOW()
     WHERE id = $6 AND tenant_id = $7 AND is_deleted = FALSE
     RETURNING *`,
    [data.name, data.website, data.phone, data.address, data.notes, id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteCompany(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    `UPDATE companies SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
    [id, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findOrCreateCompany(tenantId: string, name: string): Promise<Company> {
  const existing = await query(
    `SELECT * FROM companies WHERE tenant_id = $1 AND lower(name) = lower($2) AND is_deleted = FALSE LIMIT 1`,
    [tenantId, name]
  )
  if (existing.rows[0]) return mapRow(existing.rows[0])
  return createCompany({ tenantId, name })
}
