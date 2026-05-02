import { Request, Response } from 'express';
import { findSettingsByUserId, upsertSettings } from '../models/settingsModel';

export async function getSettings(req: Request, res: Response) {
  if (req.user!.role === 'sales' && req.params.userId !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  try {
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
  if (req.user!.role === 'sales' && req.params.userId !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { kpiCards, sections, navigation } = req.body;
  try {
    const settings = await upsertSettings(req.params.userId, req.user!.tenantId, { kpiCards, sections, navigation });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
