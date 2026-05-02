import { Router } from 'express';
import authRoutes          from './auth';
import userRoutes          from './users';
import leadRoutes          from './leads';
import taskRoutes          from './tasks';
import activityRoutes      from './activities';
import salesTargetRoutes   from './salesTargets';
import settingsRoutes      from './settings';
import kpiRoutes           from './kpis';
import tenantRoutes        from './tenants';
import tenantConfigRoutes  from './tenantConfig';
import superAdminRoutes    from './superAdmin';
import notificationRoutes  from './notifications';
import importRoutes        from './import';

const router = Router();

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/leads/import',  importRoutes);
router.use('/leads',         leadRoutes);
router.use('/tasks',         taskRoutes);
router.use('/activities',    activityRoutes);
router.use('/sales-targets', salesTargetRoutes);
router.use('/settings',      settingsRoutes);
router.use('/kpis',          kpiRoutes);
router.use('/tenants',       tenantRoutes);
router.use('/tenant/config', tenantConfigRoutes);
router.use('/super-admin',   superAdminRoutes);
router.use('/notifications', notificationRoutes);

export default router;
