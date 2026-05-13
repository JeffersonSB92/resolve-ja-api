import { FastifyPluginAsync } from 'fastify';
import {
  approveProviderController,
  listAdminReportsController,
  listAdminRequestsController,
  listPendingProvidersController,
  rejectProviderController,
  suspendProviderController,
} from './admin.controller.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminProtectedRoute = {
    preHandler: [app.authenticate, app.requireAdmin],
  };

  app.get('/admin/providers/pending', adminProtectedRoute, listPendingProvidersController);
  app.post('/admin/providers/:id/approve', adminProtectedRoute, approveProviderController);
  app.post('/admin/providers/:id/reject', adminProtectedRoute, rejectProviderController);
  app.post('/admin/providers/:id/suspend', adminProtectedRoute, suspendProviderController);
  app.get('/admin/requests', adminProtectedRoute, listAdminRequestsController);
  app.get('/admin/reports', adminProtectedRoute, listAdminReportsController);
};

export default adminRoutes;
