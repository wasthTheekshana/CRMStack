import { Request, Response } from 'express';
import { findAllActivities, findActivitiesByLead, createActivity } from '../models/activityModel';

export async function listActivities(req: Request, res: Response) {
  try {
    const activities = await findAllActivities(req.user!.userId, req.user!.tenantId, req.user!.role === 'admin');
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listActivitiesByLead(req: Request, res: Response) {
  try {
    const activities = await findActivitiesByLead(req.params.leadId, req.user!.tenantId);
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createActivityHandler(req: Request, res: Response) {
  const { leadId, type, description, metadata } = req.body;
  if (!type || !description) {
    res.status(400).json({ error: 'type and description required' });
    return;
  }
  const MANUAL_TYPES = ['note', 'call', 'email', 'meeting'] as const;
  if (!MANUAL_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid activity type' });
    return;
  }
  try {
    const activity = await createActivity({
      leadId:   leadId || null,
      type,
      description,
      metadata: metadata ?? null,
      ownerId:  req.user!.userId,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
