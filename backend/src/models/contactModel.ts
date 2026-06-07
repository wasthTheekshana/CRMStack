import { query } from '../config/db'

export interface Contact {
  id:          string
  tenantId:    string
  companyId:   string | null
  name:        string
  phone:       string | null
  email:       string | null
  designation: string | null
  createdAt:   string
  updatedAt:   string
}

const mapRow = (r: Record<string, unknown>): Contact => ({
  id:          r.id          as string,
  tenantId:    r.tenant_id   as string,
  companyId:   (r.company_id as string) ?? null,
  name:        r.name        as string,
  phone:       (r.phone      as string) ?? null,
  email:       (r.email      as string) ?? null,
  designation: (r.designation as string) ?? null,
  createdAt:   r.created_at  as string,
  updatedAt:   r.updated_at  as string,
})

export async function findAllContacts(tenantId: string): Promise<Contact[]> {
  const result = await query(
    'SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY name ASC',
    [tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findContactsByCompany(companyId: string, tenantId: string): Promise<Contact[]> {
  const result = await query(
    `SELECT * FROM contacts
      WHERE company_id = $1 AND tenant_id = $2
      ORDER BY name ASC`,
    [companyId, tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findContactById(id: string, tenantId: string): Promise<Contact | null> {
  const result = await query(
    'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createContact(data: {
  tenantId:     string
  companyId:    string | null
  name:         string
  phone?:       string | null
  email?:       string | null
  designation?: string | null
}): Promise<Contact> {
  const result = await query(
    `INSERT INTO contacts (tenant_id, company_id, name, phone, email, designation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.tenantId, data.companyId, data.name,
     data.phone ?? null, data.email ?? null, data.designation ?? null]
  )
  return mapRow(result.rows[0])
}

export async function updateContact(id: string, tenantId: string, data: {
  name?:        string
  phone?:       string | null
  email?:       string | null
  designation?: string | null
  companyId?:   string | null
}): Promise<Contact | null> {
  const result = await query(
    `UPDATE contacts SET
       name        = COALESCE($1, name),
       phone       = COALESCE($2, phone),
       email       = COALESCE($3, email),
       designation = COALESCE($4, designation),
       company_id  = COALESCE($5, company_id),
       updated_at  = NOW()
     WHERE id = $6 AND tenant_id = $7
     RETURNING *`,
    [data.name, data.phone, data.email, data.designation, data.companyId, id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteContact(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM contacts WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}
