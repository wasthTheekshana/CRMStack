import { Request, Response } from 'express'
import {
  findAllCompanies, findCompanyById,
  createCompany, updateCompany, deleteCompany,
} from '../models/companyModel'
import { findContactsByCompany } from '../models/contactModel'

export async function listCompanies(req: Request, res: Response) {
  try {
    const isAdmin = req.user!.role === 'admin'
    const companies = await findAllCompanies(req.user!.tenantId, isAdmin ? undefined : req.user!.userId)
    res.json(companies)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function getCompany(req: Request, res: Response) {
  try {
    const isAdmin = req.user!.role === 'admin'
    const company = await findCompanyById(req.params.id, req.user!.tenantId, isAdmin ? undefined : req.user!.userId)
    if (!company) { res.status(404).json({ error: 'Not found' }); return }
    const contacts = await findContactsByCompany(req.params.id, req.user!.tenantId)
    res.json({ ...company, contacts })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createCompanyHandler(req: Request, res: Response) {
  const { name, website, phone, address, notes } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  try {
    const company = await createCompany({
      tenantId: req.user!.tenantId,
      ownerId:  req.user!.userId,
      name:     name.trim(),
      website:  website ?? null,
      phone:    phone   ?? null,
      address:  address ?? null,
      notes:    notes   ?? null,
    })
    res.status(201).json(company)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateCompanyHandler(req: Request, res: Response) {
  const { name, website, phone, address, notes } = req.body
  try {
    const isAdmin = req.user!.role === 'admin'
    const updated = await updateCompany(
      req.params.id, req.user!.tenantId,
      { name: name?.trim(), website, phone, address, notes },
      isAdmin ? undefined : req.user!.userId
    )
    if (!updated) { res.status(404).json({ error: 'Not found' }); return }
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteCompanyHandler(req: Request, res: Response) {
  try {
    const isAdmin = req.user!.role === 'admin'
    const deleted = await deleteCompany(req.params.id, req.user!.tenantId, isAdmin ? undefined : req.user!.userId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
