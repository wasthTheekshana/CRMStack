import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSuperAdmin } from '../middleware/superAdminAuth';
import {
  login,
  saLogout,
  saMe,
  getStats,
  listTenants,
  createTenant,
  getTenantDetail,
  updateTenant,
  exportTenantCSV,
  deleteTenant,
  searchUsers,
  resetUserPassword,
} from '../controllers/superAdminController';

const router = Router();

// H2: 5 attempts per 15 minutes — SA login is a high-value brute-force target
const saLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/auth/login',            saLoginLimiter, login);
router.post('/auth/logout',           saLogout);
router.get('/me',                     requireSuperAdmin, saMe);
router.get('/stats',                  requireSuperAdmin, getStats);
router.get('/tenants',                requireSuperAdmin, listTenants);
router.post('/tenants',               requireSuperAdmin, createTenant);
router.get('/tenants/:id',            requireSuperAdmin, getTenantDetail);
router.put('/tenants/:id',            requireSuperAdmin, updateTenant);
router.get('/tenants/:id/export',     requireSuperAdmin, exportTenantCSV);
router.delete('/tenants/:id',         requireSuperAdmin, deleteTenant);
router.get('/users/search',           requireSuperAdmin, searchUsers);
router.put('/users/:id/password',     requireSuperAdmin, resetUserPassword);

export default router;
