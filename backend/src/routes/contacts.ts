import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listAllContacts, listContactsByCompany,
  createContactHandler, updateContactHandler, deleteContactHandler,
} from '../controllers/contactController'

const router = Router()

// GET /api/contacts — all contacts for tenant
// GET /api/contacts?companyId=xxx — filtered by company
router.get('/', requireAuth, (req, res) => {
  const companyId = req.query.companyId
  if (typeof companyId === 'string' && companyId !== '') {
    req.params.companyId = companyId
    return listContactsByCompany(req, res)
  }
  return listAllContacts(req, res)
})

router.post('/',      requireAuth, createContactHandler)
router.put('/:id',    requireAuth, updateContactHandler)
router.delete('/:id', requireAuth, deleteContactHandler)

export default router
