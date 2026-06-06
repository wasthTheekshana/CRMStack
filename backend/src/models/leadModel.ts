import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapLead = (row: Record<string, unknown>) => ({
  id:               row.id,
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
  const result = isAdmin
    ? await query(
        'SELECT * FROM leads WHERE is_deleted = FALSE AND tenant_id = $1 ORDER BY updated_at DESC',
        [tenantId]
      )
    : await query(
        'SELECT * FROM leads WHERE is_deleted = FALSE AND tenant_id = $1 AND owner_id = $2 ORDER BY updated_at DESC',
        [tenantId, userId]
      );
  return result.rows.map(mapLead);
}

export async function findDeletedLeads(userId: string, tenantId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query(
        'SELECT * FROM leads WHERE is_deleted = TRUE AND tenant_id = $1 ORDER BY deleted_at DESC',
        [tenantId]
      )
    : await query(
        'SELECT * FROM leads WHERE is_deleted = TRUE AND tenant_id = $1 AND owner_id = $2 ORDER BY deleted_at DESC',
        [tenantId, userId]
      );
  return result.rows.map(mapLead);
}

export async function findLeadById(id: string, tenantId: string) {
  const result = await query(
    'SELECT * FROM leads WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0] ? mapLead(result.rows[0]) : null;
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
       (company_name, solution, contacts, sales_stage, image_count, box_count,
        estimated_revenue, probability, remarks, ho_update, position,
        owner_id, owner_email, tenant_id, custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      data.companyName, data.solution, JSON.stringify(data.contacts),
      data.salesStage, data.imageCount, data.boxCount,
      data.estimatedRevenue, data.probability, data.remarks, data.hoUpdate,
      data.position, data.ownerId, data.ownerEmail,
      data.tenantId, JSON.stringify(data.customFields ?? {}),
    ]
  );
  return mapLead(result.rows[0]);
}

export async function updateLead(id: string, tenantId: string, data: {
  companyName?:      string;
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
       solution          = COALESCE($2,  solution),
       contacts          = COALESCE($3,  contacts),
       sales_stage       = COALESCE($4,  sales_stage),
       image_count       = COALESCE($5,  image_count),
       box_count         = COALESCE($6,  box_count),
       estimated_revenue = COALESCE($7,  estimated_revenue),
       probability       = COALESCE($8,  probability),
       remarks           = COALESCE($9,  remarks),
       ho_update         = COALESCE($10, ho_update),
       position          = COALESCE($11, position),
       owner_id          = COALESCE($12, owner_id),
       owner_email       = COALESCE($13, owner_email),
       custom_fields     = COALESCE($14, custom_fields)
     WHERE id = $15 AND tenant_id = $16
     RETURNING *`,
    [
      data.companyName, data.solution,
      data.contacts !== undefined ? JSON.stringify(data.contacts) : null,
      data.salesStage, data.imageCount, data.boxCount,
      data.estimatedRevenue, data.probability, data.remarks, data.hoUpdate,
      data.position, data.ownerId, data.ownerEmail,
      data.customFields !== undefined ? JSON.stringify(data.customFields) : null,
      id, tenantId,
    ]
  );
  return result.rows[0] ? mapLead(result.rows[0]) : null;
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
