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

const MAX_STR = 500; // max length for standard string fields
const MAX_CUSTOM_KEYS = 50;
const MAX_CUSTOM_VALUE_LEN = 1000;

function validateLeadFields(body: Record<string, unknown>): string | null {
  const strFields = ['companyName', 'solution', 'salesStage', 'remarks', 'hoUpdate', 'position', 'ownerEmail'] as const;
  for (const field of strFields) {
    const val = body[field];
    if (typeof val === 'string' && val.length > MAX_STR) {
      return `${field} must be at most ${MAX_STR} characters`;
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
    companyName, solution, contacts, salesStage,
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

  try {
    const lead = await createLead({
      companyName, solution,
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
    });
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
    companyName, solution, contacts, salesStage,
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

    const lead = await updateLead(req.params.id, req.user!.tenantId, {
      companyName, solution, contacts, salesStage,
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
