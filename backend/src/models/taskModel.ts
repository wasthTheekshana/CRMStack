import { query } from '../config/db';

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapTask = (row: Record<string, unknown>) => ({
  id:          row.id,
  leadId:      row.lead_id,
  title:       row.title,
  description: row.description,
  type:        row.type,
  dueDate:     row.due_date,
  status:      row.status,
  priority:    row.priority,
  ownerId:     row.owner_id,
  tenantId:    row.tenant_id,
  createdAt:   row.created_at,
  completedAt: row.completed_at,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findAllTasks(userId: string, tenantId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY due_date ASC',
        [tenantId]
      )
    : await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 AND owner_id = $2 ORDER BY due_date ASC',
        [tenantId, userId]
      );
  return result.rows.map(mapTask);
}

export async function createTask(data: {
  leadId:      string | null;
  title:       string;
  description: string;
  type:        string;
  dueDate:     string;
  priority:    string;
  ownerId:     string;
  tenantId:    string;
}) {
  const result = await query(
    `INSERT INTO tasks (lead_id, title, description, type, due_date, priority, owner_id, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.leadId, data.title, data.description, data.type, data.dueDate, data.priority, data.ownerId, data.tenantId]
  );
  return mapTask(result.rows[0]);
}

export async function updateTask(id: string, tenantId: string, data: {
  title?:       string;
  description?: string;
  type?:        string;
  dueDate?:     string;
  status?:      string;
  priority?:    string;
}) {
  const result = await query(
    `UPDATE tasks SET
       title       = COALESCE($1, title),
       description = COALESCE($2, description),
       type        = COALESCE($3, type),
       due_date    = COALESCE($4, due_date),
       status      = COALESCE($5, status),
       priority    = COALESCE($6, priority),
       completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END
     WHERE id = $7 AND tenant_id = $8 RETURNING *`,
    [data.title, data.description, data.type, data.dueDate, data.status, data.priority, id, tenantId]
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

export async function removeTask(id: string, tenantId: string) {
  await query('DELETE FROM tasks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

export async function findTasksDueToday(): Promise<Array<{
  id: string; title: string; ownerId: string; tenantId: string;
}>> {
  const result = await query(
    `SELECT id, title, owner_id, tenant_id FROM tasks
      WHERE due_date = CURRENT_DATE
        AND status   != 'completed'
        AND tenant_id IS NOT NULL`
  );
  return result.rows.map((r) => ({
    id:       r.id       as string,
    title:    r.title    as string,
    ownerId:  r.owner_id as string,
    tenantId: r.tenant_id as string,
  }));
}

export async function findOverdueTasks(): Promise<Array<{
  id: string; title: string; ownerId: string; tenantId: string; dueDate: string;
}>> {
  const result = await query(
    `SELECT id, title, owner_id, tenant_id, due_date FROM tasks
      WHERE due_date < CURRENT_DATE
        AND status   != 'completed'
        AND tenant_id IS NOT NULL`
  );
  return result.rows.map((r) => ({
    id:       r.id        as string,
    title:    r.title     as string,
    ownerId:  r.owner_id  as string,
    tenantId: r.tenant_id as string,
    dueDate:  r.due_date  as string,
  }));
}
