import { Request, Response } from 'express';
import {
  findConfigByTenantId,
  upsertConfig,
  DEFAULT_STAGES,
  DEFAULT_SOLUTIONS,
} from '../models/tenantConfigModel';
import { renameLeadStage, renameLeadSolution } from '../models/leadModel';

/** GET /api/tenant/config — returns the config for the requesting tenant */
export async function getConfig(req: Request, res: Response) {
  try {
    const config = await findConfigByTenantId(req.user!.tenantId);

    // If no config row yet, return defaults so the frontend always gets something useful
    if (!config) {
      res.json({
        tenantId:      req.user!.tenantId,
        salesStages:   DEFAULT_STAGES,
        solutions:     DEFAULT_SOLUTIONS,
        customFields:  [],
        visibleFields: {
          imageCount: true, boxCount: true,
          hoUpdate: true, probability: true, remarks: true,
        },
        branding: {},
      });
      return;
    }

    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** PUT /api/tenant/config — admin saves a full or partial config update */
export async function updateConfig(req: Request, res: Response) {
  const { salesStages, solutions, customFields, visibleFields, branding } = req.body;

  // Validate that exactly one stage has isWon: true
  if (salesStages != null) {
    const wonStages = (salesStages as { isWon?: boolean }[]).filter(s => s.isWon);
    if (wonStages.length !== 1) {
      res.status(400).json({ error: 'Exactly one stage must be marked as the Won stage' });
      return;
    }
  }

  try {
    const tenantId = req.user!.tenantId;

    // Cascade stage renames to all leads before saving the new config
    if (salesStages != null) {
      const existing = await findConfigByTenantId(tenantId);
      const existingMap = new Map((existing?.salesStages ?? DEFAULT_STAGES).map(s => [s.id, s.name]));
      for (const stage of salesStages as { id: string; name: string }[]) {
        const oldName = existingMap.get(stage.id);
        if (oldName != null && oldName !== stage.name) {
          await renameLeadStage(tenantId, oldName, stage.name);
        }
      }
    }

    // Cascade solution renames to all leads before saving the new config
    if (solutions != null) {
      const existing = await findConfigByTenantId(tenantId);
      const existingMap = new Map((existing?.solutions ?? DEFAULT_SOLUTIONS).map(s => [s.id, s.name]));
      for (const solution of solutions as { id: string; name: string }[]) {
        const oldName = existingMap.get(solution.id);
        if (oldName != null && oldName !== solution.name) {
          await renameLeadSolution(tenantId, oldName, solution.name);
        }
      }
    }

    const config = await upsertConfig(tenantId, {
      salesStages, solutions, customFields, visibleFields, branding,
    });
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
