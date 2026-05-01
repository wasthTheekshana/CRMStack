import { Request, Response } from 'express';
import { findLeadById } from '../models/leadModel';
import {
  getExpiry,
  upsertExpiry,
  deleteExpiry,
  getExpiryByTenant,
} from '../models/leadExpiryModel';

function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

export async function getBulkLeadExpiryHandler(req: Request, res: Response) {
  try {
    const actor = req.user!;
    const rows  = await getExpiryByTenant(actor.tenantId);
    const map: Record<string, { expiryDate: string; daysUntil: number }> = {};
    for (const row of rows) {
      map[row.leadId] = {
        expiryDate: row.expiryDate,
        daysUntil:  daysUntilExpiry(row.expiryDate),
      };
    }
    res.json(map);
  } catch (err) {
    console.error('getBulkLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLeadExpiryHandler(req: Request, res: Response) {
  try {
    const actor  = req.user!;
    const { id } = req.params;
    const lead   = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    const expiry = await getExpiry(id);
    res.json(expiry ?? null);
  } catch (err) {
    console.error('getLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function setLeadExpiryHandler(req: Request, res: Response) {
  const actor      = req.user!;
  const { id }     = req.params;
  const { expiryDate } = req.body as { expiryDate?: string };

  if (!expiryDate) {
    res.status(400).json({ error: 'expiryDate is required (YYYY-MM-DD)' }); return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  if (expiry <= today) {
    res.status(400).json({ error: 'Expiry date must be in the future' }); return;
  }

  try {
    const lead = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const isAdmin = actor.role === 'admin';
    const isOwner = lead.ownerId === actor.userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Only admins or the lead owner can set expiry' }); return;
    }

    const result = await upsertExpiry(id, actor.tenantId, expiryDate, actor.userId);
    res.json(result);
  } catch (err) {
    console.error('setLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteLeadExpiryHandler(req: Request, res: Response) {
  const actor  = req.user!;
  const { id } = req.params;

  try {
    const lead = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const isAdmin = actor.role === 'admin';
    const isOwner = lead.ownerId === actor.userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Only admins or the lead owner can remove expiry' }); return;
    }

    await deleteExpiry(id, actor.tenantId);
    res.status(204).send();
  } catch (err) {
    console.error('deleteLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
