import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listCompanies, getCompany, createCompanyHandler,
  updateCompanyHandler, deleteCompanyHandler,
} from '../controllers/companyController'

const router = Router()

router.get('/',       requireAuth, listCompanies)
router.get('/:id',    requireAuth, getCompany)
router.post('/',      requireAuth, requireAdmin, createCompanyHandler)
router.put('/:id',    requireAuth, requireAdmin, updateCompanyHandler)
router.delete('/:id', requireAuth, requireAdmin, deleteCompanyHandler)

export default router
