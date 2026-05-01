// backend/src/models/leadExpiryModel.ts
import { query } from '../config/db';

export interface LeadExpiry {
  id:              string;
  leadId:          string;
  tenantId:        string;
  expiryDate:      string;   // "YYYY-MM-DD"
  setBy:           string;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
  notified1d:      boolean;
  notifiedExpired: boolean;
  createdAt:       string;
  updatedAt:       string;
}

export interface ExpiryReminderRow {
  leadId:          string;
  tenantId:        string;
  expiryDate:      string;
  ownerId:         string;
  companyName:     string;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
  notified1d:      boolean;
  notifiedExpired: boolean;
}

const mapExpiry = (row: Record<string, unknown>): LeadExpiry => ({
  id:              row.id              as string,
  leadId:          row.lead_id         as string,
  tenantId:        row.tenant_id       as string,
  expiryDate:      row.expiry_date     as string,
  setBy:           row.set_by          as string,
  notified7d:      row.notified_7d     as boolean,
  notified5d:      row.notified_5d     as boolean,
  notified2d:      row.notified_2d     as boolean,
  notified1d:      row.notified_1d     as boolean,
  notifiedExpired: row.notified_expired as boolean,
  createdAt:       row.created_at      as string,
  updatedAt:       row.updated_at      as string,
});

export async function getExpiry(leadId: string): Promise<LeadExpiry | null> {
  const result = await query(
    'SELECT * FROM lead_expiry WHERE lead_id = $1',
    [leadId]
  );
  return result.rows[0] ? mapExpiry(result.rows[0]) : null;
}

export async function upsertExpiry(
  leadId:     string,
  tenantId:   string,
  expiryDate: string,
  setBy:      string
): Promise<LeadExpiry> {
  const result = await query(
    `INSERT INTO lead_expiry (lead_id, tenant_id, expiry_date, set_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lead_id) DO UPDATE SET
       expiry_date      = $3,
       set_by           = $4,
       notified_7d      = FALSE,
       notified_5d      = FALSE,
       notified_2d      = FALSE,
       notified_1d      = FALSE,
       notified_expired = FALSE,
       updated_at       = NOW()
     RETURNING *`,
    [leadId, tenantId, expiryDate, setBy]
  );
  return mapExpiry(result.rows[0]);
}

export async function deleteExpiry(leadId: string, tenantId: string): Promise<void> {
  await query(
    'DELETE FROM lead_expiry WHERE lead_id = $1 AND tenant_id = $2',
    [leadId, tenantId]
  );
}

export async function getExpiryByTenant(
  tenantId: string
): Promise<{ leadId: string; expiryDate: string }[]> {
  const result = await query(
    'SELECT lead_id, expiry_date FROM lead_expiry WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows.map(row => ({
    leadId:     row.lead_id    as string,
    expiryDate: row.expiry_date as string,
  }));
}

export async function getLeadsWithPendingReminders(): Promise<ExpiryReminderRow[]> {
  const result = await query(
    `SELECT
       le.lead_id,
       le.tenant_id,
       le.expiry_date,
       le.notified_7d,
       le.notified_5d,
       le.notified_2d,
       le.notified_1d,
       le.notified_expired,
       l.owner_id,
       l.company_name
     FROM lead_expiry le
     JOIN leads l ON l.id = le.lead_id
     WHERE l.is_deleted = FALSE
       AND le.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
       AND NOT (
         le.notified_7d AND le.notified_5d AND le.notified_2d
         AND le.notified_1d AND le.notified_expired
       )`,
    []
  );
  return result.rows.map(row => ({
    leadId:          row.lead_id          as string,
    tenantId:        row.tenant_id        as string,
    expiryDate:      row.expiry_date      as string,
    ownerId:         row.owner_id         as string,
    companyName:     row.company_name     as string,
    notified7d:      row.notified_7d      as boolean,
    notified5d:      row.notified_5d      as boolean,
    notified2d:      row.notified_2d      as boolean,
    notified1d:      row.notified_1d      as boolean,
    notifiedExpired: row.notified_expired as boolean,
  }));
}

export async function markReminderSent(
  leadId:   string,
  interval: '7d' | '5d' | '2d' | '1d' | 'expired'
): Promise<void> {
  const colMap: Record<string, string> = {
    '7d':      'notified_7d',
    '5d':      'notified_5d',
    '2d':      'notified_2d',
    '1d':      'notified_1d',
    'expired': 'notified_expired',
  };
  const col = colMap[interval];
  await query(
    `UPDATE lead_expiry SET ${col} = TRUE, updated_at = NOW() WHERE lead_id = $1`,
    [leadId]
  );
}
