import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listTasks,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from '../controllers/taskController';

const router = Router();

router.get('/',     requireAuth, listTasks);
router.post('/',    requireAuth, createTaskHandler);
router.put('/:id',  requireAuth, updateTaskHandler);
router.delete('/:id', requireAuth, deleteTaskHandler);

export default router;
