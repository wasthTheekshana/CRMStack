import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listSavedViews, createSavedViewHandler, deleteSavedViewHandler } from '../controllers/savedViewController'

const router = Router()

router.get('/',       requireAuth, listSavedViews)
router.post('/',      requireAuth, createSavedViewHandler)
router.delete('/:id', requireAuth, deleteSavedViewHandler)

export default router
