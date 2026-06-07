import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listAllContacts, listContactsByCompany,
  createContactHandler, updateContactHandler, deleteContactHandler,
} from '../controllers/contactController'

const router = Router()

// GET /api/contacts — scoped by role in controller (admin = all, sales = own)
// GET /api/contacts?companyId=xxx — filtered by company
router.get('/', requireAuth, (req, res) => {
  const companyId = req.query.companyId
  if (typeof companyId === 'string' && companyId !== '') {
    req.params.companyId = companyId
    return listContactsByCompany(req, res)
  }
  return listAllContacts(req, res)
})

router.post('/',      requireAuth, requireAdmin, createContactHandler)
router.put('/:id',    requireAuth, requireAdmin, updateContactHandler)
router.delete('/:id', requireAuth, requireAdmin, deleteContactHandler)

export default router
