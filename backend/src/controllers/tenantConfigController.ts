import { Request, Response } from 'express';
import {
  findConfigByTenantId,
  upsertConfig,
  FieldConfig,
  DEFAULT_STAGES,
  DEFAULT_SOLUTIONS,
} from '../models/tenantConfigModel';
import { renameLeadStage, renameLeadSolution } from '../models/leadModel';
import { detectCircularRefs } from '../utils/formulaEngine';

/** GET /api/tenant/config — returns the config for the requesting tenant */
export async function getConfig(req: Request, res: Response) {
  try {
    const config = await findConfigByTenantId(req.user!.tenantId);

    // If no config row yet, return defaults so the frontend always gets something useful
    if (!config) {
      res.json({
        tenantId:             req.user!.tenantId,
        salesStages:          DEFAULT_STAGES,
        solutions:            DEFAULT_SOLUTIONS,
        customFields:         [],
        visibleFields:        {},
        fieldGroups:          [],
        dashboardWidgets:     [],
        coreFieldVisibility:  { probability: true },
        branding:             {},
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
  const {
    salesStages, solutions, customFields, visibleFields,
    fieldGroups, dashboardWidgets, coreFieldVisibility, branding,
  } = req.body;

  // Validate that exactly one stage has isWon: true
  if (salesStages != null) {
    const wonStages = (salesStages as { isWon?: boolean }[]).filter(s => s.isWon);
    if (wonStages.length !== 1) {
      res.status(400).json({ error: 'Exactly one stage must be marked as the Won stage' });
      return;
    }
  }

  // Validate formula fields for circular references
  if (customFields != null) {
    const formulaFields = (customFields as FieldConfig[]).filter(
      (f: FieldConfig) => f.type === 'formula' && f.formula
    )
    if (formulaFields.length > 0) {
      const cycle = detectCircularRefs(formulaFields)
      if (cycle) {
        res.status(400).json({
          error: `Circular reference detected: ${cycle.join(' → ')}`
        })
        return
      }
    }
  }

  // Validate dashboardWidgets
  const VALID_WIDGET_TYPES = new Set(['sum', 'average', 'count', 'min', 'max', 'group_by'])
  const VALID_CHART_TYPES  = new Set(['number', 'bar', 'pie', 'table'])
  const VALID_ROLES        = new Set(['both', 'admin', 'sales'])

  if (Array.isArray(dashboardWidgets)) {
    for (const w of dashboardWidgets) {
      if (!VALID_WIDGET_TYPES.has(w.type)) {
        res.status(400).json({ error: `Invalid widget type: ${w.type}` })
        return
      }
      if (!VALID_CHART_TYPES.has(w.chart_type)) {
        res.status(400).json({ error: `Invalid chart type: ${w.chart_type}` })
        return
      }
      if (!VALID_ROLES.has(w.role)) {
        res.status(400).json({ error: `Invalid widget role: ${w.role}` })
        return
      }
      if (w.type !== 'count' && !w.field_id) {
        res.status(400).json({ error: `Widget "${w.name}" requires a field_id` })
        return
      }
      // A group_by widget without group_by_field falls into kpiController's scalar
      // branch at read time and returns {value} instead of an array — the frontend's
      // bar/pie/table renderers require an array, so it renders empty with no error.
      if (w.type === 'group_by' && !w.group_by_field) {
        res.status(400).json({ error: `Widget "${w.name}" requires a "Group By" field` })
        return
      }
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
      salesStages, solutions, customFields, visibleFields,
      fieldGroups, dashboardWidgets, coreFieldVisibility, branding,
    });
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
