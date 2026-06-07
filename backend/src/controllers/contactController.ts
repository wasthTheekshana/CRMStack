import { Request, Response } from 'express'
import { findAllContacts, findContactsByOwner, findContactsByCompany, findContactById, createContact, updateContact, deleteContact } from '../models/contactModel'
import { findCompanyById } from '../models/companyModel'
import { ownsLeadForCompany } from '../models/leadModel'

export async function listAllContacts(req: Request, res: Response) {
  try {
    const isAdmin = req.user!.role === 'admin'
    const contacts = isAdmin
      ? await findAllContacts(req.user!.tenantId)
      : await findContactsByOwner(req.user!.userId, req.user!.tenantId)
    res.json(contacts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function listContactsByCompany(req: Request, res: Response) {
  try {
    const isAdmin = req.user!.role === 'admin'
    if (!isAdmin) {
      const owns = await ownsLeadForCompany(req.user!.userId, req.params.companyId, req.user!.tenantId)
      if (!owns) { res.status(404).json({ error: 'Not found' }); return }
    }
    const contacts = await findContactsByCompany(req.params.companyId, req.user!.tenantId)
    res.json(contacts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createContactHandler(req: Request, res: Response) {
  const { companyId, name, phone, email, designation } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  try {
    if (companyId) {
      const company = await findCompanyById(companyId, req.user!.tenantId)
      if (!company) {
        res.status(400).json({ error: 'Invalid companyId' })
        return
      }
    }
    const contact = await createContact({
      tenantId:    req.user!.tenantId,
      companyId:   companyId ?? null,
      name:        name.trim(),
      phone:       phone ?? null,
      email:       email ?? null,
      designation: designation ?? null,
    })
    res.status(201).json(contact)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateContactHandler(req: Request, res: Response) {
  const { name, phone, email, designation, companyId } = req.body
  try {
    if (companyId != null) {
      const company = await findCompanyById(companyId, req.user!.tenantId)
      if (!company) {
        res.status(400).json({ error: 'Invalid companyId' })
        return
      }
    }
    const updated = await updateContact(req.params.id, req.user!.tenantId, {
      name: name?.trim(), phone, email, designation, companyId,
    })
    if (!updated) { res.status(404).json({ error: 'Not found' }); return }
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteContactHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteContact(req.params.id, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
