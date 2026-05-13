import { FastifyPluginAsync } from 'fastify';
import {
  createProviderProfileController,
  createProviderServiceMeController,
  deleteProviderServiceMeController,
  getProviderProfileMeController,
  listAvailableRequestsController,
  listProviderServicesMeController,
  updateProviderProfileMeController,
  updateProviderServiceMeController,
} from './provider.controller.js';

const providerRoutes: FastifyPluginAsync = async (app) => {
  const protectedRoute = {
    preHandler: app.authenticate,
  };

  app.post('/providers/profile', protectedRoute, createProviderProfileController);
  app.get('/providers/me', protectedRoute, getProviderProfileMeController);
  app.get('/providers/available-requests', protectedRoute, listAvailableRequestsController);
  app.patch('/providers/me', protectedRoute, updateProviderProfileMeController);
  app.post('/providers/me/services', protectedRoute, createProviderServiceMeController);
  app.get('/providers/me/services', protectedRoute, listProviderServicesMeController);
  app.patch(
    '/providers/me/services/:serviceId',
    protectedRoute,
    updateProviderServiceMeController,
  );
  app.delete(
    '/providers/me/services/:serviceId',
    protectedRoute,
    deleteProviderServiceMeController,
  );
};

export default providerRoutes;
