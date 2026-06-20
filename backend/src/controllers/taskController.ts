import { Request, Response } from 'express';
import { findAllTasks, findTasksByLead, createTask, updateTask, removeTask } from '../models/taskModel';
import { getLeadOwnerId } from '../models/leadModel';
import { notifyTaskAssigned } from '../services/notificationService';

export async function listTasks(req: Request, res: Response) {
  try {
    const tasks = await findAllTasks(req.user!.userId, req.user!.tenantId, req.user!.role === 'admin');
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listTasksByLead(req: Request, res: Response) {
  try {
    // Sales users may only see tasks for leads they own; admins see all.
    if (req.user!.role === 'sales') {
      const ownerId = await getLeadOwnerId(req.params.leadId, req.user!.tenantId);
      if (ownerId !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }
    }
    const tasks = await findTasksByLead(req.params.leadId, req.user!.tenantId);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createTaskHandler(req: Request, res: Response) {
  const { leadId, title, description, type, dueDate, priority } = req.body;
  if (!title || !type || !dueDate) {
    res.status(400).json({ error: 'title, type, dueDate required' });
    return;
  }
  try {
    const task = await createTask({
      leadId:      leadId || null,
      title,
      description: description || '',
      type,
      dueDate,
      priority:    priority || 'medium',
      ownerId:     req.user!.userId,
      tenantId:    req.user!.tenantId,
    });
    void notifyTaskAssigned({
      tenantId:   req.user!.tenantId,
      assigneeId: task.ownerId as string,
      actorId:    req.user!.userId,
      taskTitle:  task.title  as string,
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTaskHandler(req: Request, res: Response) {
  const { title, description, type, dueDate, status, priority } = req.body;
  try {
    // Non-admins may only modify their own tasks.
    const ownerScope = req.user!.role === 'admin' ? undefined : req.user!.userId;
    const task = await updateTask(req.params.id, req.user!.tenantId, { title, description, type, dueDate, status, priority }, ownerScope);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTaskHandler(req: Request, res: Response) {
  try {
    // Non-admins may only delete their own tasks.
    const ownerScope = req.user!.role === 'admin' ? undefined : req.user!.userId;
    const deleted = await removeTask(req.params.id, req.user!.tenantId, ownerScope);
    if (!deleted) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
