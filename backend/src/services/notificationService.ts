// backend/src/services/notificationService.ts
import { createNotification } from '../models/notificationModel';

async function notify(params: {
  tenantId: string;
  userId:   string;
  type:     string;
  title:    string;
  body:     string;
  link?:    string;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch (err) {
    console.error('[NotificationService] failed to create notification:', err);
  }
}

export function notifyLeadAssigned(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): void {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_assigned',
    title:    'Lead assigned to you',
    body:     `${params.companyName} has been assigned to you.`,
    link:     '/leads',
  });
}

export function notifyLeadStageChanged(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
  oldStage:    string;
  newStage:    string;
}): void {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_stage_changed',
    title:    'Lead stage updated',
    body:     `${params.companyName} moved from ${params.oldStage} to ${params.newStage}.`,
    link:     '/leads',
  });
}

export function notifyLeadDeleted(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): void {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_deleted',
    title:    'Lead deleted',
    body:     `${params.companyName} has been deleted.`,
    link:     '/leads/deleted',
  });
}

export function notifyLeadRestored(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): void {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_restored',
    title:    'Lead restored',
    body:     `${params.companyName} has been restored.`,
    link:     '/leads',
  });
}

export function notifyTaskAssigned(params: {
  tenantId:   string;
  assigneeId: string;
  actorId:    string;
  taskTitle:  string;
}): void {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_assigned',
    title:    'Task assigned to you',
    body:     `Task "${params.taskTitle}" has been assigned to you.`,
    link:     '/tasks',
  });
}

export function notifyTaskDueToday(params: {
  tenantId:   string;
  assigneeId: string;
  taskTitle:  string;
}): void {
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_due_today',
    title:    'Task due today',
    body:     `Task "${params.taskTitle}" is due today.`,
    link:     '/tasks',
  });
}

export function notifyTaskOverdue(params: {
  tenantId:   string;
  assigneeId: string;
  taskTitle:  string;
  dueDate:    string;
}): void {
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_overdue',
    title:    'Task overdue',
    body:     `Task "${params.taskTitle}" is overdue (was due ${params.dueDate}).`,
    link:     '/tasks',
  });
}

export function notifyTeamMemberAdded(params: {
  tenantId:     string;
  adminIds:     string[];
  newUserName:  string;
  newUserEmail: string;
}): void {
  for (const adminId of params.adminIds) {
    void notify({
      tenantId: params.tenantId,
      userId:   adminId,
      type:     'team_member_added',
      title:    'New team member',
      body:     `${params.newUserName} (${params.newUserEmail}) has joined your workspace.`,
      link:     '/admin/team',
    });
  }
}

export function notifyUserDeactivated(params: {
  tenantId: string;
  adminIds: string[];
  userName: string;
}): void {
  for (const adminId of params.adminIds) {
    void notify({
      tenantId: params.tenantId,
      userId:   adminId,
      type:     'user_deactivated',
      title:    'User deactivated',
      body:     `${params.userName} has been deactivated.`,
      link:     '/admin/team',
    });
  }
}

export async function notifyLeadExpiryReminder(params: {
  tenantId:     string;
  companyName:  string;
  daysUntil:    number;   // 7, 5, 2, 1, or 0
  recipientIds: string[];
}): Promise<void> {
  const { tenantId, companyName, daysUntil, recipientIds } = params;
  const isExpired = daysUntil === 0;

  const title = isExpired
    ? `Lead has expired: ${companyName}`
    : `Lead expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${companyName}`;

  const body = isExpired
    ? `${companyName} has passed its expiry date.`
    : `${companyName} will expire in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`;

  const type = isExpired ? 'lead_expired' : 'lead_expiry_reminder';

  for (const userId of recipientIds) {
    await notify({ tenantId, userId, type, title, body, link: '/leads' });
  }
}
