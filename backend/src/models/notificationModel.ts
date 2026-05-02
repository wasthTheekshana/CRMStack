// backend/src/models/notificationModel.ts
import { query } from '../config/db';

export interface NotificationRow {
  id:         string;
  type:       string;
  title:      string;
  body:       string;
  link:       string | null;
  readAt:     string | null;
  createdAt:  string;
}

const mapRow = (r: Record<string, unknown>): NotificationRow => ({
  id:        r.id          as string,
  type:      r.type        as string,
  title:     r.title       as string,
  body:      r.body        as string,
  link:      (r.link       as string | null) ?? null,
  readAt:    (r.read_at    as string | null) ?? null,
  createdAt: r.created_at  as string,
});

export async function createNotification(params: {
  tenantId: string;
  userId:   string;
  type:     string;
  title:    string;
  body:     string;
  link?:    string;
}): Promise<void> {
  await query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.tenantId, params.userId, params.type, params.title, params.body, params.link ?? null]
  );
}

export async function getNotifications(
  userId: string,
  tenantId: string,
  limit = 20
): Promise<NotificationRow[]> {
  const result = await query(
    `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications
      WHERE user_id      = $1
        AND tenant_id    = $2
        AND dismissed_at IS NULL
      ORDER BY
        read_at IS NULL DESC,
        created_at DESC
      LIMIT $3`,
    [userId, tenantId, limit]
  );
  return result.rows.map(mapRow);
}

export async function getUnreadCount(userId: string, tenantId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) FROM notifications
      WHERE user_id = $1 AND tenant_id = $2
        AND read_at IS NULL AND dismissed_at IS NULL`,
    [userId, tenantId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markAllRead(userId: string, tenantId: string): Promise<void> {
  await query(
    `UPDATE notifications
        SET read_at = NOW()
      WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL`,
    [userId, tenantId]
  );
}

export async function dismissNotification(
  id: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const result = await query(
    `UPDATE notifications
        SET dismissed_at = NOW()
      WHERE id = $1 AND user_id = $2 AND tenant_id = $3
        AND dismissed_at IS NULL`,
    [id, userId, tenantId]
  );
  return (result.rowCount ?? 0) > 0;
}
