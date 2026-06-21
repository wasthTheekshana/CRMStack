import { Request, Response } from 'express';
import { findAllActivities, findActivitiesByLead, createActivity, updateActivity } from '../models/activityModel';
import { getLeadOwnerId } from '../models/leadModel';

const MANUAL_TYPES: readonly string[] = ['note', 'call', 'email', 'meeting'];
const ALL_ACTIVITY_TYPES: readonly string[] = ['note', 'stage_change', 'call', 'email', 'meeting'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listActivities(req: Request, res: Response) {
  try {
    const { ownerId, type, leadId, startDate, endDate, limit } =
      req.query as Record<string, string | undefined>;

    if (type && !ALL_ACTIVITY_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid activity type' }); return;
    }
    if (ownerId && !UUID_RE.test(ownerId)) {
      res.status(400).json({ error: 'Invalid ownerId' }); return;
    }
    if (leadId && !UUID_RE.test(leadId)) {
      res.status(400).json({ error: 'Invalid leadId' }); return;
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      res.status(400).json({ error: 'Invalid startDate' }); return;
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      res.status(400).json({ error: 'Invalid endDate' }); return;
    }
    // A date-only endDate (YYYY-MM-DD) should include the whole day, not stop at midnight.
    const normalizedEndDate =
      endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999Z` : endDate;
    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        res.status(400).json({ error: 'Invalid limit' }); return;
      }
    }

    const isAdmin = req.user!.role === 'admin';
    const activities = await findAllActivities(
      req.user!.userId,
      req.user!.tenantId,
      isAdmin,
      {
        // Non-admins must never filter by another member; force undefined so the
        // model's own-owner restriction applies.
        ownerId: isAdmin ? ownerId : undefined,
        type, leadId, startDate, endDate: normalizedEndDate, limit: parsedLimit,
      }
    );
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listActivitiesByLead(req: Request, res: Response) {
  try {
    // Sales users may only see activities for leads they own; admins see all.
    if (req.user!.role === 'sales') {
      const ownerId = await getLeadOwnerId(req.params.leadId, req.user!.tenantId);
      if (ownerId !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }
    }
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

export async function updateActivityHandler(req: Request, res: Response) {
  const { type, description } = req.body;
  if (type === undefined && description === undefined) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  // Only manually-logged activity types are editable; auto stage_change is not.
  if (type !== undefined && !MANUAL_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid activity type' });
    return;
  }
  try {
    // Non-admins may only edit their own activities.
    const ownerScope = req.user!.role === 'admin' ? undefined : req.user!.userId;
    const activity = await updateActivity(req.params.id, req.user!.tenantId, { type, description }, ownerScope);
    if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
