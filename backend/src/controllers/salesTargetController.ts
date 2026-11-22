import { Request, Response } from 'express';
import { findAllTargets, upsertTarget, updateTarget, removeTarget } from '../models/salesTargetModel';
import { findUserByIdInTenant } from '../models/userModel';

export async function listTargets(req: Request, res: Response) {
  try {
    const targets = await findAllTargets(req.user!.userId, req.user!.tenantId, req.user!.role === 'admin');
    res.json(targets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createTargetHandler(req: Request, res: Response) {
  const { year, month, target, achievement, ownerId, ownerEmail, ownerName } = req.body;
  if (!year || !month) {
    res.status(400).json({ error: 'year and month required' });
    return;
  }
  let actualOwnerId    = req.user!.role === 'sales' ? req.user!.userId : (ownerId || req.user!.userId);
  let actualOwnerEmail = req.user!.role === 'sales' ? req.user!.email  : (ownerEmail || req.user!.email);
  try {
    // An admin may set a target for another user, but only a user of their own tenant.
    if (req.user!.role !== 'sales' && actualOwnerId !== req.user!.userId) {
      if (typeof actualOwnerId !== 'string') {
        res.status(400).json({ error: 'ownerId must be a user id' });
        return;
      }
      const owner = await findUserByIdInTenant(actualOwnerId, req.user!.tenantId);
      if (!owner) {
        res.status(400).json({ error: 'ownerId must belong to a user in your workspace' });
        return;
      }
      actualOwnerId = owner.id;
      actualOwnerEmail = owner.email;
    }
    const result = await upsertTarget({
      year, month,
      target:      target || 0,
      achievement: achievement || 0,
      ownerId:     actualOwnerId,
      ownerEmail:  actualOwnerEmail,
      ownerName:   ownerName || '',
      tenantId:    req.user!.tenantId,
    });
    if (!result) {
      res.status(409).json({ error: 'A target for this user and month already exists' });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTargetHandler(req: Request, res: Response) {
  const { target, achievement } = req.body;
  try {
    // Non-admins may only update their own target.
    const ownerScope = req.user!.role === 'admin' ? undefined : req.user!.userId;
    const result = await updateTarget(req.params.id, req.user!.tenantId, { target, achievement }, ownerScope);
    if (!result) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTargetHandler(req: Request, res: Response) {
  try {
    await removeTarget(req.params.id, req.user!.tenantId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
