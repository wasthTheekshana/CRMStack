import { Request, Response } from 'express';
import {
  findAllLeads,
  findDeletedLeads,
  findLeadById,
  getLeadOwnerId,
  createLead,
  updateLead,
  softDeleteLead,
  restoreLead,
  hardDeleteAllLeads,
} from '../models/leadModel';
import { findUserByIdInTenant } from '../models/userModel';
import {
  notifyLeadAssigned,
  notifyLeadStageChanged,
  notifyLeadDeleted,
  notifyLeadRestored,
} from '../services/notificationService';
import { createActivity } from '../models/activityModel';
import { countActiveLeads } from '../models/tenantModel';
import { findConfigByTenantId } from '../models/tenantConfigModel';
import { findCompanyById } from '../models/companyModel';
import { pool } from '../config/db';

const MAX_STR      = 500;   // short fields: names, stages, emails
const MAX_TEXT     = 5000;  // free-text fields: remarks, hoUpdate
const MAX_CUSTOM_KEYS = 50;
const MAX_CUSTOM_VALUE_LEN = 1000;

function validateLeadFields(body: Record<string, unknown>): string | null {
  const shortFields = ['companyName', 'solution', 'salesStage', 'position', 'ownerEmail'] as const;
  for (const field of shortFields) {
    const val = body[field];
    if (typeof val === 'string' && val.length > MAX_STR) {
      return `${field} must be at most ${MAX_STR} characters`;
    }
  }

  for (const field of ['remarks', 'hoUpdate'] as const) {
    const val = body[field];
    if (typeof val === 'string' && val.length > MAX_TEXT) {
      return `${field} must be at most ${MAX_TEXT} characters`;
    }
  }

  if (body.customFields != null) {
    if (typeof body.customFields !== 'object' || Array.isArray(body.customFields)) {
      return 'customFields must be an object';
    }
    const cf = body.customFields as Record<string, unknown>;
    if (Object.keys(cf).length > MAX_CUSTOM_KEYS) {
      return `customFields must have at most ${MAX_CUSTOM_KEYS} keys`;
    }
    for (const [key, value] of Object.entries(cf)) {
      if (key.length > 100) return 'customFields key too long';
      if (typeof value === 'string' && value.length > MAX_CUSTOM_VALUE_LEN) {
        return `customFields value for "${key}" too long`;
      }
    }
  }

  return null; // valid
}

async function validateRequiredCustomFields(
  tenantId: string,
  customFields: Record<string, unknown>
): Promise<string | null> {
  const config = await findConfigByTenantId(tenantId)
  if (!config) return null
  for (const field of config.customFields) {
    if (!field.required) continue
    const value = customFields[field.id]
    const isEmpty =
      value == null ||
      (typeof value === 'string' && value.trim() === '') ||
      (field.type === 'checkbox' && value === false)
    if (isEmpty) {
      return `"${field.name}" is required`
    }
  }
  return null
}

export async function listLeads(req: Request, res: Response) {
  try {
    const leads = await findAllLeads(req.user!.userId, req.user!.tenantId, req.user!.role === 'admin');
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listDeletedLeads(req: Request, res: Response) {
  try {
    const leads = await findDeletedLeads(req.user!.userId, req.user!.tenantId, req.user!.role === 'admin');
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getLead(req: Request, res: Response) {
  try {
    const lead = await findLeadById(req.params.id, req.user!.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    if (req.user!.role === 'sales' && lead.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createLeadHandler(req: Request, res: Response) {
  const {
    companyName, companyId, solution, contacts, salesStage,
    imageCount, boxCount, estimatedRevenue, probability,
    remarks, hoUpdate, position, ownerId, ownerEmail, customFields,
  } = req.body;

  if (!companyName || !solution || !salesStage) {
    res.status(400).json({ error: 'companyName, solution, salesStage required' });
    return;
  }

  const validationError = validateLeadFields(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const actualOwnerId    = req.user!.role === 'sales' ? req.user!.userId : (ownerId || req.user!.userId);
  const actualOwnerEmail = req.user!.role === 'sales' ? req.user!.email  : (ownerEmail || req.user!.email);

  if (companyId) {
    try {
      const company = await findCompanyById(companyId, req.user!.tenantId, actualOwnerId)
      if (!company) {
        res.status(400).json({ error: 'Invalid companyId' })
        return
      }
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
      return
    }
  }

  try {
    const cfError = await validateRequiredCustomFields(
      req.user!.tenantId,
      (customFields as Record<string, unknown>) ?? {}
    )
    if (cfError) {
      res.status(400).json({ error: cfError })
      return
    }

    let lead
    if (req.tenant?.leadLimit != null) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Advisory lock serializes concurrent lead creation per tenant
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.user!.tenantId])
        const countResult = await client.query(
          'SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE',
          [req.user!.tenantId]
        )
        const currentCount = parseInt(countResult.rows[0].count, 10)
        if (currentCount >= req.tenant.leadLimit) {
          await client.query('ROLLBACK')
          res.status(403).json({
            error: 'LEAD_LIMIT_REACHED',
            message: `Your plan allows up to ${req.tenant.leadLimit} leads. Please upgrade to add more.`,
            limit: req.tenant.leadLimit,
            current: currentCount,
          })
          return
        }
        const insertResult = await client.query(
          `INSERT INTO leads
             (company_name, company_id, solution, contacts, sales_stage,
              image_count, box_count, estimated_revenue, probability, remarks,
              ho_update, position, owner_id, owner_email, tenant_id, custom_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING *`,
          [
            companyName, companyId ?? null, solution,
            JSON.stringify(contacts || []),
            salesStage, imageCount || 0, boxCount || 0,
            estimatedRevenue || 0, probability || 0,
            remarks || '', hoUpdate || '', position || null,
            actualOwnerId, actualOwnerEmail,
            req.user!.tenantId, JSON.stringify(customFields ?? {}),
          ]
        )
        await client.query('COMMIT')
        const { mapLead } = await import('../models/leadModel')
        lead = mapLead(insertResult.rows[0])
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } else {
      lead = await createLead({
        companyName,
        companyId:        companyId ?? null,
        solution,
        contacts:         contacts || [],
        salesStage,
        imageCount:       imageCount || 0,
        boxCount:         boxCount || 0,
        estimatedRevenue: estimatedRevenue || 0,
        probability:      probability || 0,
        remarks:          remarks || '',
        hoUpdate:         hoUpdate || '',
        position:         position || null,
        ownerId:          actualOwnerId,
        ownerEmail:       actualOwnerEmail,
        tenantId:         req.user!.tenantId,
        customFields:     customFields || {},
      })
    }

    void notifyLeadAssigned({
      tenantId:    req.user!.tenantId,
      assigneeId:  lead.ownerId as string,
      actorId:     req.user!.userId,
      companyName: lead.companyName as string,
    });
    res.status(201).json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateLeadHandler(req: Request, res: Response) {
  const {
    companyName, companyId, solution, contacts, salesStage,
    imageCount, boxCount, estimatedRevenue, probability,
    remarks, hoUpdate, position, ownerId, ownerEmail, customFields,
  } = req.body;

  try {
    const existingLead = await findLeadById(req.params.id, req.user!.tenantId);
    if (!existingLead) { res.status(404).json({ error: 'Lead not found' }); return; }

    if (req.user!.role === 'sales' && existingLead.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const validationError = validateLeadFields(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const merged = {
      ...(existingLead.customFields as Record<string, unknown> ?? {}),
      ...(customFields != null ? (customFields as Record<string, unknown>) : {}),
    }
    const cfError = await validateRequiredCustomFields(req.user!.tenantId, merged)
    if (cfError) {
      res.status(400).json({ error: cfError })
      return
    }

    if (companyId != null) {
      const isAdmin = req.user!.role === 'admin'
      const company = await findCompanyById(companyId, req.user!.tenantId, isAdmin ? undefined : req.user!.userId)
      if (!company) {
        res.status(400).json({ error: 'Invalid companyId' })
        return
      }
    }

    const lead = await updateLead(req.params.id, req.user!.tenantId, {
      companyName, companyId, solution, contacts, salesStage,
      imageCount, boxCount, estimatedRevenue, probability,
      remarks, hoUpdate, position, ownerId, ownerEmail, customFields,
    });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const newOwnerId = lead.ownerId   as string;
    const newStage   = lead.salesStage as string;
    const oldOwnerId = existingLead.ownerId   as string;
    const oldStage   = existingLead.salesStage as string;

    if (newOwnerId && newOwnerId !== oldOwnerId) {
      void notifyLeadAssigned({
        tenantId:    req.user!.tenantId,
        assigneeId:  newOwnerId,
        actorId:     req.user!.userId,
        companyName: lead.companyName as string,
      });
    }
    if (newStage && newStage !== oldStage) {
      void notifyLeadStageChanged({
        tenantId:    req.user!.tenantId,
        assigneeId:  newOwnerId,
        actorId:     req.user!.userId,
        companyName: lead.companyName as string,
        oldStage,
        newStage,
      });
      void createActivity({
        leadId:      lead.id as string,
        type:        'stage_change',
        description: `Stage changed: ${oldStage} → ${newStage}`,
        metadata:    null,
        ownerId:     req.user!.userId,
        tenantId:    req.user!.tenantId,
      });
    }

    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteLeadHandler(req: Request, res: Response) {
  try {
    if (req.user!.role === 'sales') {
      const existingOwnerId = await getLeadOwnerId(req.params.id, req.user!.tenantId);
      if (existingOwnerId !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }
    }
    const existingLead = await findLeadById(req.params.id, req.user!.tenantId);
    await softDeleteLead(req.params.id, req.user!.tenantId);
    if (existingLead) {
      void notifyLeadDeleted({
        tenantId:    req.user!.tenantId,
        assigneeId:  existingLead.ownerId as string,
        actorId:     req.user!.userId,
        companyName: existingLead.companyName as string,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function restoreLeadHandler(req: Request, res: Response) {
  try {
    const lead = await restoreLead(req.params.id, req.user!.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    void notifyLeadRestored({
      tenantId:    req.user!.tenantId,
      assigneeId:  lead.ownerId as string,
      actorId:     req.user!.userId,
      companyName: lead.companyName as string,
    });
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function reassignLeadHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { ownerId } = req.body;

  if (!ownerId) {
    res.status(400).json({ error: 'ownerId is required' }); return;
  }

  try {
    const existing = await findLeadById(id, req.user!.tenantId);
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' }); return;
    }

    if (existing.ownerId === ownerId) {
      res.json(existing); return;
    }

    const newOwner = await findUserByIdInTenant(ownerId, req.user!.tenantId);
    if (!newOwner || !newOwner.isActive) {
      res.status(400).json({ error: 'Invalid owner: user not found or not in this tenant' }); return;
    }

    const updated = await updateLead(id, req.user!.tenantId, {
      ownerId:    newOwner.id    as string,
      ownerEmail: newOwner.email as string,
    });
    if (!updated) {
      res.status(404).json({ error: 'Lead not found' }); return;
    }

    void notifyLeadAssigned({
      tenantId:    req.user!.tenantId,
      assigneeId:  newOwner.id  as string,
      actorId:     req.user!.userId,
      companyName: existing.companyName as string,
    });

    res.json(updated);
  } catch (err) {
    console.error('reassignLeadHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAllLeadsHandler(req: Request, res: Response) {
  try {
    const count = await hardDeleteAllLeads(req.user!.tenantId);
    res.json({ deleted: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkUpdateLeads(req: Request, res: Response) {
  const { ids, update } = req.body as {
    ids:    string[]
    update: { salesStage?: string; ownerId?: string; ownerEmail?: string }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }

  const MAX_BULK = 500
  if (ids.length > MAX_BULK) {
    res.status(400).json({ error: `Cannot bulk-process more than ${MAX_BULK} leads at once` })
    return
  }

  const ALLOWED_FIELDS = ['salesStage', 'ownerId', 'ownerEmail']
  const keys = Object.keys(update ?? {})
  if (keys.length === 0 || keys.some(k => !ALLOWED_FIELDS.includes(k))) {
    res.status(400).json({ error: 'update must contain only: salesStage, ownerId, ownerEmail' })
    return
  }

  if ((update.ownerId != null) !== (update.ownerEmail != null)) {
    res.status(400).json({ error: 'ownerId and ownerEmail must be provided together' })
    return
  }

  try {
    const { tenantId, userId, role } = req.user!

    if (update.ownerId != null) {
      const newOwner = await findUserByIdInTenant(update.ownerId, tenantId)
      if (!newOwner || !newOwner.isActive) {
        res.status(400).json({ error: 'Invalid ownerId: user not found or inactive in this tenant' })
        return
      }
    }

    const results: { id: string; ok: boolean }[] = []
    for (const id of ids) {
      const ownerId = await getLeadOwnerId(id, tenantId)
      if (!ownerId) { results.push({ id, ok: false }); continue }
      if (role !== 'admin' && ownerId !== userId) { results.push({ id, ok: false }); continue }
      await updateLead(id, tenantId, update)
      results.push({ id, ok: true })
    }
    res.json({ results, updated: results.filter(r => r.ok).length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function bulkDeleteLeads(req: Request, res: Response) {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }

  const MAX_BULK = 500
  if (ids.length > MAX_BULK) {
    res.status(400).json({ error: `Cannot bulk-process more than ${MAX_BULK} leads at once` })
    return
  }

  try {
    const { tenantId } = req.user!
    let deleted = 0
    for (const id of ids) {
      const ok = await softDeleteLead(id, tenantId)
      if (ok) deleted++
    }
    res.json({ deleted })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
