import cron from 'node-cron';
import { findTasksDueToday, findOverdueTasks } from './models/taskModel';
import { getLeadsWithPendingReminders, markReminderSent } from './models/leadExpiryModel';
import { findAdminsByTenant } from './models/userModel';
import {
  notifyTaskDueToday,
  notifyTaskOverdue,
  notifyLeadExpiryReminder,
} from './services/notificationService';
import { pool } from './config/db';

// H5: Distributed lock key — prevents duplicate runs in multi-instance deployments
const SCHEDULER_LOCK_KEY = 7_391_842;

async function acquireSchedulerLock(): Promise<(() => Promise<void>) | null> {
  const client = await pool.connect();
  const result = await client.query('SELECT pg_try_advisory_lock($1)', [SCHEDULER_LOCK_KEY]);
  if (!result.rows[0].pg_try_advisory_lock) {
    client.release();
    return null;
  }
  return async () => {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEDULER_LOCK_KEY]);
    client.release();
  };
}

async function checkTaskNotifications(): Promise<void> {
  try {
    const dueTasks = await findTasksDueToday();
    for (const task of dueTasks) {
      // H6: await each notification so errors are not silently swallowed
      await notifyTaskDueToday({
        tenantId:   task.tenantId,
        assigneeId: task.ownerId,
        taskTitle:  task.title,
      });
    }
    console.log(`[Scheduler] Sent ${dueTasks.length} due-today notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing due-today tasks:', err);
  }

  try {
    const overdueTasks = await findOverdueTasks();
    for (const task of overdueTasks) {
      await notifyTaskOverdue({
        tenantId:   task.tenantId,
        assigneeId: task.ownerId,
        taskTitle:  task.title,
        dueDate:    task.dueDate,
      });
    }
    console.log(`[Scheduler] Sent ${overdueTasks.length} overdue notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing overdue tasks:', err);
  }
}

function parseLocalDate(dateStr: string | Date): Date {
  const s = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

const daysMap: Record<string, number> = { '7d': 7, '5d': 5, '2d': 2, '1d': 1, 'expired': 0 };

async function checkLeadExpiry(): Promise<void> {
  try {
    const rows = await getLeadsWithPendingReminders();
    const today = todayMidnight();
    let sent = 0;

    for (const row of rows) {
      const expiry = parseLocalDate(row.expiryDate);
      const daysUntil = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);

      const interval =
        (daysUntil <= 0 && !row.notifiedExpired) ? 'expired' :
        (daysUntil <= 1 && !row.notified1d)      ? '1d'      :
        (daysUntil <= 2 && !row.notified2d)      ? '2d'      :
        (daysUntil <= 5 && !row.notified5d)      ? '5d'      :
        (daysUntil <= 7 && !row.notified7d)      ? '7d'      :
        null;

      if (!interval) continue;

      const admins = await findAdminsByTenant(row.tenantId);
      const recipientIds = [...new Set([row.ownerId, ...admins.map(a => a.id)])];

      await notifyLeadExpiryReminder({
        tenantId:    row.tenantId,
        companyName: row.companyName,
        daysUntil:   daysMap[interval],
        recipientIds,
      });

      await markReminderSent(row.leadId, interval as '7d' | '5d' | '2d' | '1d' | 'expired');
      sent++;
    }

    console.log(`[Scheduler] Sent ${sent} lead expiry reminder notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing lead expiry reminders:', err);
  }
}

export function startScheduler(): void {
  cron.schedule('0 8 * * *', async () => {
    // H5: Only one instance runs the daily jobs at a time
    const release = await acquireSchedulerLock();
    if (!release) {
      console.log('[Scheduler] Another instance is running jobs, skipping');
      return;
    }
    try {
      console.log('[Scheduler] Running daily jobs');
      await checkTaskNotifications();
      await checkLeadExpiry();
    } finally {
      await release();
    }
  });

  console.log('[Scheduler] Daily jobs scheduled (08:00)');
}
