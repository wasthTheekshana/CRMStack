import { Request, Response } from 'express';
import { findAllTasks, createTask, updateTask, removeTask } from '../models/taskModel';
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
    const task = await updateTask(req.params.id, req.user!.tenantId, { title, description, type, dueDate, status, priority });
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTaskHandler(req: Request, res: Response) {
  try {
    await removeTask(req.params.id, req.user!.tenantId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
