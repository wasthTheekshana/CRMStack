import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapLead = (row: Record<string, unknown>) => ({
  id:               row.id,
  companyId:        (row.company_id as string) ?? null,
  companyName:      row.company_name,
  solution:         row.solution,
  contacts:         row.contacts,
  salesStage:       row.sales_stage,
  imageCount:       row.image_count,
  boxCount:         row.box_count,
  estimatedRevenue: parseFloat(row.estimated_revenue as string),
  probability:      row.probability,
  remarks:          row.remarks,
  hoUpdate:         row.ho_update,
  position:         row.position,
  ownerId:          row.owner_id,
  ownerEmail:       row.owner_email,
  tenantId:         row.tenant_id,
  customFields:     row.custom_fields ?? {},
  isDeleted:        row.is_deleted,
  deletedAt:        row.deleted_at,
  createdAt:        row.created_at,
  updatedAt:        row.updated_at,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllLeads(userId: string, tenantId: string, isAdmin: boolean) {
  const base = `
    SELECT l.*,
           COALESCE(c.name, l.company_name) AS company_name
      FROM leads l
      LEFT JOIN companies c ON c.id = l.company_id AND c.tenant_id = l.tenant_id
     WHERE l.is_deleted = FALSE AND l.tenant_id = $1`

  const result = isAdmin
    ? await query(base + ' ORDER BY l.updated_at DESC', [tenantId])
    : await query(base + ' AND l.owner_id = $2 ORDER BY l.updated_at DESC', [tenantId, userId])
  return result.rows.map(mapLead)
}

export async function findDeletedLeads(userId: string, tenantId: string, isAdmin: boolean) {
  const base = `
    SELECT l.*,
           COALESCE(c.name, l.company_name) AS company_name
      FROM leads l
      LEFT JOIN companies c ON c.id = l.company_id AND c.tenant_id = l.tenant_id
     WHERE l.is_deleted = TRUE AND l.tenant_id = $1`

  const result = isAdmin
    ? await query(base + ' ORDER BY l.deleted_at DESC', [tenantId])
    : await query(base + ' AND l.owner_id = $2 ORDER BY l.deleted_at DESC', [tenantId, userId])
  return result.rows.map(mapLead)
}

export async function findLeadById(id: string, tenantId: string) {
  const result = await query(
    `SELECT l.*,
            COALESCE(c.name, l.company_name) AS company_name
       FROM leads l
       LEFT JOIN companies c ON c.id = l.company_id AND c.tenant_id = l.tenant_id
      WHERE l.id = $1 AND l.tenant_id = $2`,
    [id, tenantId]
  )
  return result.rows[0] ? mapLead(result.rows[0]) : null
}

export async function ownsLeadForCompany(userId: string, companyId: string, tenantId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM leads
      WHERE owner_id = $1 AND company_id = $2 AND tenant_id = $3 AND is_deleted = FALSE
      LIMIT 1`,
    [userId, companyId, tenantId]
  )
  return result.rows.length > 0
}

export async function getLeadOwnerId(id: string, tenantId: string): Promise<string | null> {
  const result = await query(
    'SELECT owner_id FROM leads WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0]?.owner_id ?? null;
}

export async function createLead(data: {
  companyName:      string;
  companyId?:       string | null;
  solution:         string;
  contacts:         unknown[];
  salesStage:       string;
  imageCount:       number;
  boxCount:         number;
  estimatedRevenue: number;
  probability:      number;
  remarks:          string;
  hoUpdate:         string;
  position:         number | null;
  ownerId:          string;
  ownerEmail:       string;
  tenantId:         string;
  customFields?:    Record<string, unknown>;
}) {
  const result = await query(
    `INSERT INTO leads
       (company_name, company_id, solution, contacts, sales_stage,
        image_count, box_count, estimated_revenue, probability, remarks,
        ho_update, position, owner_id, owner_email, tenant_id, custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      data.companyName,
      data.companyId ?? null,
      data.solution,
      JSON.stringify(data.contacts),
      data.salesStage,
      data.imageCount,
      data.boxCount,
      data.estimatedRevenue,
      data.probability,
      data.remarks,
      data.hoUpdate,
      data.position,
      data.ownerId,
      data.ownerEmail,
      data.tenantId,
      JSON.stringify(data.customFields ?? {}),
    ]
  )
  return mapLead(result.rows[0])
}

export async function updateLead(id: string, tenantId: string, data: {
  companyName?:      string;
  companyId?:        string | null;
  solution?:         string;
  contacts?:         unknown[];
  salesStage?:       string;
  imageCount?:       number;
  boxCount?:         number;
  estimatedRevenue?: number;
  probability?:      number;
  remarks?:          string;
  hoUpdate?:         string;
  position?:         number | null;
  ownerId?:          string;
  ownerEmail?:       string;
  customFields?:     Record<string, unknown>;
}) {
  const result = await query(
    `UPDATE leads SET
       company_name      = COALESCE($1,  company_name),
       company_id        = COALESCE($2,  company_id),
       solution          = COALESCE($3,  solution),
       contacts          = COALESCE($4,  contacts),
       sales_stage       = COALESCE($5,  sales_stage),
       image_count       = COALESCE($6,  image_count),
       box_count         = COALESCE($7,  box_count),
       estimated_revenue = COALESCE($8,  estimated_revenue),
       probability       = COALESCE($9,  probability),
       remarks           = COALESCE($10, remarks),
       ho_update         = COALESCE($11, ho_update),
       position          = COALESCE($12, position),
       owner_id          = COALESCE($13, owner_id),
       owner_email       = COALESCE($14, owner_email),
       custom_fields     = COALESCE($15, custom_fields)
     WHERE id = $16 AND tenant_id = $17
     RETURNING *`,
    [
      data.companyName,
      data.companyId !== undefined ? data.companyId : null,
      data.solution,
      data.contacts !== undefined ? JSON.stringify(data.contacts) : null,
      data.salesStage,
      data.imageCount,
      data.boxCount,
      data.estimatedRevenue,
      data.probability,
      data.remarks,
      data.hoUpdate,
      data.position,
      data.ownerId,
      data.ownerEmail,
      data.customFields !== undefined ? JSON.stringify(data.customFields) : null,
      id,
      tenantId,
    ]
  )
  return result.rows[0] ? mapLead(result.rows[0]) : null
}

export async function softDeleteLead(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'UPDATE leads SET is_deleted = TRUE, deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE',
    [id, tenantId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function restoreLead(id: string, tenantId: string) {
  const result = await query(
    'UPDATE leads SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1 AND tenant_id = $2 RETURNING *',
    [id, tenantId]
  );
  return result.rows[0] ? mapLead(result.rows[0]) : null;
}

export async function hardDeleteAllLeads(tenantId: string): Promise<number> {
  const result = await query(
    'DELETE FROM leads WHERE tenant_id = $1',
    [tenantId]
  );
  return (result as { rowCount: number }).rowCount;
}

export async function renameLeadStage(tenantId: string, oldName: string, newName: string): Promise<number> {
  const result = await query(
    'UPDATE leads SET sales_stage = $1 WHERE tenant_id = $2 AND sales_stage = $3',
    [newName, tenantId, oldName]
  );
  return (result as { rowCount: number }).rowCount;
}

export async function renameLeadSolution(tenantId: string, oldName: string, newName: string): Promise<number> {
  const result = await query(
    'UPDATE leads SET solution = $1 WHERE tenant_id = $2 AND solution = $3',
    [newName, tenantId, oldName]
  );
  return (result as { rowCount: number }).rowCount;
}
