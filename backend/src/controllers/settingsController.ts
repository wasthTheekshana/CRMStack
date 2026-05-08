import { Request, Response } from 'express';
import { findSettingsByUserId, upsertSettings } from '../models/settingsModel';
import { findUserByIdInTenant } from '../models/userModel';

async function assertTenantOwnership(req: Request, res: Response): Promise<boolean> {
  const { userId } = req.params;
  if (userId === req.user!.userId) return true;
  if (req.user!.role === 'sales') {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  const target = await findUserByIdInTenant(userId, req.user!.tenantId);
  if (!target) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  return true;
}

export async function getSettings(req: Request, res: Response) {
  try {
    if (!await assertTenantOwnership(req, res)) return;
    const settings = await findSettingsByUserId(req.params.userId, req.user!.tenantId);
    if (!settings) {
      res.json({ userId: req.params.userId, kpiCards: {}, sections: {}, navigation: {} });
      return;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    if (!await assertTenantOwnership(req, res)) return;
    const { kpiCards, sections, navigation } = req.body;
    const settings = await upsertSettings(req.params.userId, req.user!.tenantId, { kpiCards, sections, navigation });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
