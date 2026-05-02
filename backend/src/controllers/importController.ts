import { Request, Response } from 'express';
import { query } from '../config/db';
import { createLead, updateLead } from '../models/leadModel';
import { findConfigByTenantId, DEFAULT_STAGES, DEFAULT_SOLUTIONS } from '../models/tenantConfigModel';
import { findUserByEmailInTenant, findUserByIdInTenant } from '../models/userModel';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface ImportRow {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: string;
  probability:      string;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       string;
  boxCount:         string;
  contactName:      string;
  contactPhone:     string;
  contactEmail:     string;
  ownerEmail:       string;
}

interface ParsedRow {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: number;
  probability:      number;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       number;
  boxCount:         number;
  contacts:         { name: string; phone: string; email: string; isPrimary: boolean }[];
  ownerId:          string;
  ownerEmail:       string;
}

// ─── Helper: parse and validate a single row ──────────────────────────────────

async function parseRow(
  raw: ImportRow,
  tenantId: string,
  adminId: string,
  adminEmail: string,
  stageNames: string[],
  solutionNames: string[],
  defaultProbabilityMap: Record<string, number>
): Promise<{ parsed: ParsedRow; warnings: string[] }> {
  const warnings: string[] = [];

  // Sales stage
  let salesStage = raw.salesStage?.trim() || '';
  if (!stageNames.includes(salesStage)) {
    if (salesStage) warnings.push(`Stage "${salesStage}" not found — using "${stageNames[0]}"`);
    salesStage = stageNames[0];
  }

  // Solution
  let solution = raw.solution?.trim() || '';
  if (solution && !solutionNames.includes(solution)) {
    warnings.push(`Solution "${solution}" not found — left blank`);
    solution = '';
  }

  // Probability
  let probability = parseInt(raw.probability, 10);
  if (isNaN(probability)) {
    probability = defaultProbabilityMap[salesStage] ?? 0;
  }
  probability = Math.max(0, Math.min(100, probability));

  // Numeric fields
  let estimatedRevenue = parseFloat(raw.estimatedRevenue);
  if (isNaN(estimatedRevenue)) { estimatedRevenue = 0; }

  let imageCount = parseInt(raw.imageCount, 10);
  if (isNaN(imageCount)) { imageCount = 0; }

  let boxCount = parseInt(raw.boxCount, 10);
  if (isNaN(boxCount)) { boxCount = 0; }

  // Owner
  let ownerId = adminId;
  let ownerEmail = adminEmail;
  const rawOwnerEmail = raw.ownerEmail?.trim();
  if (rawOwnerEmail) {
    const user = await findUserByEmailInTenant(rawOwnerEmail, tenantId);
    if (user) {
      ownerId    = user.id;
      ownerEmail = user.email;
    } else {
      warnings.push(`Owner "${rawOwnerEmail}" not found — assigned to you`);
    }
  }

  // Contact
  const contacts = raw.contactName?.trim()
    ? [{ name: raw.contactName.trim(), phone: raw.contactPhone?.trim() || '', email: raw.contactEmail?.trim() || '', isPrimary: true }]
    : [];

  return {
    parsed: {
      companyName: String(raw.companyName ?? '').trim(),
      solution,
      salesStage,
      estimatedRevenue,
      probability,
      remarks:  raw.remarks?.trim()  || '',
      hoUpdate: raw.hoUpdate?.trim() || '',
      imageCount,
      boxCount,
      contacts,
      ownerId,
      ownerEmail,
    },
    warnings,
  };
}

// ─── POST /api/leads/import/preview ──────────────────────────────────────────

export async function importPreview(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: ImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }
    if (rows.length > 1000) {
      res.status(400).json({ error: 'Maximum 1,000 rows per import' });
      return;
    }

    const tenantId   = req.user!.tenantId;
    const adminId    = req.user!.userId;
    const adminEmail = req.user!.email;

    // Load tenant config for stage/solution validation
    const config    = await findConfigByTenantId(tenantId);
    const stages    = config?.salesStages   ?? DEFAULT_STAGES;
    const solutions = config?.solutions     ?? DEFAULT_SOLUTIONS;
    const stageNames    = stages.map(s => s.name);
    const solutionNames = solutions.map(s => s.name);
    const defaultProbabilityMap: Record<string, number> = {};
    stages.forEach(s => { defaultProbabilityMap[s.name] = s.probability; });

    const result: {
      index: number;
      status: 'new' | 'duplicate';
      parsed: ParsedRow;
      existingLead?: { id: string; companyName: string; salesStage: string; ownerId: string; ownerEmail: string };
      warnings: string[];
    }[] = [];

    let totalNew = 0;
    let totalDuplicates = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      if (!raw.companyName?.trim()) continue; // skip blank company rows

      const { parsed, warnings } = await parseRow(
        raw, tenantId, adminId, adminEmail,
        stageNames, solutionNames, defaultProbabilityMap
      );

      // Duplicate detection
      const dupResult = await query(
        `SELECT id, company_name, sales_stage, owner_id, owner_email
         FROM leads
         WHERE tenant_id = $1
           AND is_deleted = FALSE
           AND LOWER(TRIM(company_name)) = LOWER(TRIM($2))`,
        [tenantId, parsed.companyName]
      );

      if (dupResult.rows[0]) {
        totalDuplicates++;
        result.push({
          index: i,
          status: 'duplicate',
          parsed,
          existingLead: {
            id:          dupResult.rows[0].id          as string,
            companyName: dupResult.rows[0].company_name as string,
            salesStage:  dupResult.rows[0].sales_stage  as string,
            ownerId:     dupResult.rows[0].owner_id     as string,
            ownerEmail:  dupResult.rows[0].owner_email  as string,
          },
          warnings,
        });
      } else {
        totalNew++;
        result.push({ index: i, status: 'new', parsed, warnings });
      }
    }

    res.json({ totalNew, totalDuplicates, rows: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/leads/import/confirm ──────────────────────────────────────────

export async function importConfirm(req: Request, res: Response) {
  try {
    const { rows } = req.body as {
      rows: Array<{
        index:       number;
        action:      'create' | 'update' | 'skip';
        existingId?: string;
        data:        ParsedRow;
      }>;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }
    if (rows.length > 1000) {
      res.status(400).json({ error: 'Maximum 1,000 rows per import' });
      return;
    }

    const tenantId = req.user!.tenantId;
    let created = 0, updated = 0, skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    // Load tenant config for stage validation
    const config = await findConfigByTenantId(tenantId);
    const stages = config?.salesStages ?? DEFAULT_STAGES;
    const stageNames = stages.map(s => s.name);

    for (const row of rows) {
      if (row.action === 'skip') {
        skipped++;
        continue;
      }

      // Verify ownerId belongs to this tenant
      if (row.data.ownerId) {
        const owner = await findUserByIdInTenant(row.data.ownerId, tenantId);
        if (!owner || !owner.isActive) {
          errors.push({ row: row.index, reason: 'Invalid owner: user not found in this tenant' });
          continue;
        }
      }

      // Verify salesStage is a valid stage for this tenant
      if (row.data.salesStage && !stageNames.includes(row.data.salesStage)) {
        errors.push({ row: row.index, reason: `Invalid salesStage: "${row.data.salesStage}"` });
        continue;
      }

      try {
        if (row.action === 'create') {
          await createLead({
            ...row.data,
            position:   null,
            tenantId,
            customFields: {},
          });
          created++;
        } else if (row.action === 'update') {
          if (row.existingId) {
            const result = await updateLead(row.existingId, tenantId, row.data);
            if (!result) {
              errors.push({ row: row.index, reason: 'Lead not found or access denied' });
            } else {
              updated++;
            }
          } else {
            errors.push({ row: row.index, reason: 'update action requires existingId' });
          }
        }
      } catch (err) {
        errors.push({ row: row.index, reason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ created, updated, skipped, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
