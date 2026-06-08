import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listCompanies, getCompany, createCompanyHandler,
  updateCompanyHandler, deleteCompanyHandler,
} from '../controllers/companyController'

const router = Router()

router.get('/',       requireAuth, listCompanies)
router.get('/:id',    requireAuth, getCompany)
router.post('/',      requireAuth, createCompanyHandler)
router.put('/:id',    requireAuth, updateCompanyHandler)
router.delete('/:id', requireAuth, deleteCompanyHandler)

export default router
