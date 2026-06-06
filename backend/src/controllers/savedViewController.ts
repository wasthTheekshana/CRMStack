import { Request, Response } from 'express'
import { findSavedViews, createSavedView, deleteSavedView } from '../models/savedViewModel'

export async function listSavedViews(req: Request, res: Response) {
  try {
    const views = await findSavedViews(req.user!.tenantId, req.user!.userId)
    res.json(views)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createSavedViewHandler(req: Request, res: Response) {
  const { name, filters } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  if (!filters || typeof filters !== 'object') {
    res.status(400).json({ error: 'filters object required' })
    return
  }
  try {
    const view = await createSavedView({
      tenantId: req.user!.tenantId,
      userId:   req.user!.userId,
      name:     name.trim(),
      filters,
    })
    res.status(201).json(view)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteSavedViewHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteSavedView(req.params.id, req.user!.userId, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
