import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapSettings = (row: Record<string, unknown>) => ({
  userId:     row.user_id,
  tenantId:   row.tenant_id,
  kpiCards:   row.kpi_cards,
  sections:   row.sections,
  navigation: row.navigation,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findSettingsByUserId(userId: string, tenantId: string) {
  const result = await query(
    'SELECT * FROM dashboard_settings WHERE user_id = $1 AND tenant_id = $2',
    [userId, tenantId]
  );
  return result.rows[0] ? mapSettings(result.rows[0]) : null;
}

export async function upsertSettings(userId: string, tenantId: string, data: {
  kpiCards?:   unknown;
  sections?:   unknown;
  navigation?: unknown;
}) {
  const result = await query(
    `INSERT INTO dashboard_settings (user_id, tenant_id, kpi_cards, sections, navigation)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET kpi_cards  = COALESCE($3, dashboard_settings.kpi_cards),
           sections   = COALESCE($4, dashboard_settings.sections),
           navigation = COALESCE($5, dashboard_settings.navigation),
           updated_at = NOW()
     RETURNING *`,
    [
      userId,
      tenantId,
      data.kpiCards   ? JSON.stringify(data.kpiCards)   : null,
      data.sections   ? JSON.stringify(data.sections)   : null,
      data.navigation ? JSON.stringify(data.navigation) : null,
    ]
  );
  return mapSettings(result.rows[0]);
}
