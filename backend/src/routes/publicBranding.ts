// backend/src/routes/publicBranding.ts
import { Router, Request, Response } from 'express'
import { resolveTenantOptional } from '../middleware/tenantResolver'
import { findConfigByTenantId } from '../models/tenantConfigModel'

const router = Router()

router.get('/', resolveTenantOptional, async (req: Request, res: Response) => {
  try {
    if (!req.tenant) {
      res.json({ companyName: null, logoUrl: null, primaryColor: null })
      return
    }
    const config = await findConfigByTenantId(req.tenant.id)
    const b = config?.branding
    res.json({
      companyName:  b?.companyName  ?? null,
      logoUrl:      b?.logoUrl      ?? null,
      primaryColor: b?.primaryColor ?? null,
    })
  } catch {
    res.json({ companyName: null, logoUrl: null, primaryColor: null })
  }
})

export default router
