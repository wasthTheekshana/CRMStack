import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listUsers,
  listSalesUsers,
  getUser,
  createUserHandler,
  updateUserHandler,
} from '../controllers/userController';

const router = Router();

router.get('/',       requireAuth, requireAdmin, listUsers);
router.get('/sales',  requireAuth,               listSalesUsers);
router.get('/:id',    requireAuth,               getUser);
router.post('/',      requireAuth, requireAdmin, createUserHandler);
router.put('/:id',    requireAuth, requireAdmin, updateUserHandler);

export default router;
