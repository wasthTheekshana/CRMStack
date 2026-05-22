import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listTasks,
  listTasksByLead,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from '../controllers/taskController';

const router = Router();

router.get('/',               requireAuth, listTasks);
router.get('/lead/:leadId',   requireAuth, listTasksByLead);
router.post('/',              requireAuth, createTaskHandler);
router.put('/:id',            requireAuth, updateTaskHandler);
router.delete('/:id',         requireAuth, deleteTaskHandler);

export default router;
