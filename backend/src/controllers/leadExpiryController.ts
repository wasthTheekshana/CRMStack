import { Request, Response } from 'express';
import { findLeadById } from '../models/leadModel';
import {
  getExpiry,
  upsertExpiry,
  deleteExpiry,
  getExpiryByTenant,
} from '../models/leadExpiryModel';

function parseLocalDate(dateStr: string | Date): Date {
  const s = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayMidnight(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

function computeDaysUntil(expiryDate: string | Date): number {
  const expiry = parseLocalDate(expiryDate)
  return Math.round((expiry.getTime() - todayMidnight().getTime()) / 86_400_000)
}

export async function getBulkLeadExpiryHandler(req: Request, res: Response) {
  try {
    const actor = req.user!;
    const rows  = await getExpiryByTenant(actor.tenantId);
    const map: Record<string, { expiryDate: string; daysUntil: number }> = {};
    for (const row of rows) {
      map[row.leadId] = {
        expiryDate: row.expiryDate,
        daysUntil:  computeDaysUntil(row.expiryDate),
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

  const today  = todayMidnight();
  const expiry = parseLocalDate(expiryDate);
  if (expiry < today) {
    res.status(400).json({ error: 'Expiry date must be today or in the future' }); return;
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
