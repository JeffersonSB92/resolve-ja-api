import { FastifyPluginAsync } from 'fastify';
import {
  cancelRequestController,
  checkInRequestController,
  confirmCompletionRequestController,
  createRequestController,
  generateStartPinController,
  getRequestByIdController,
  listMyRequestsController,
  markDoneRequestController,
  startRequestController,
  updateRequestController,
} from './request.controller.js';

const requestRoutes: FastifyPluginAsync = async (app) => {
  const protectedRoute = {
    preHandler: app.authenticate,
  };

  app.post('/requests', protectedRoute, createRequestController);
  app.get('/requests/my', protectedRoute, listMyRequestsController);
  app.get('/requests/:id', protectedRoute, getRequestByIdController);
  app.patch('/requests/:id', protectedRoute, updateRequestController);
  app.post('/requests/:id/cancel', protectedRoute, cancelRequestController);
  app.post('/requests/:id/check-in', protectedRoute, checkInRequestController);
  app.post('/requests/:id/generate-pin', protectedRoute, generateStartPinController);
  app.post('/requests/:id/start', protectedRoute, startRequestController);
  app.post('/requests/:id/mark-done', protectedRoute, markDoneRequestController);
  app.post(
    '/requests/:id/confirm-completion',
    protectedRoute,
    confirmCompletionRequestController,
  );
};

export default requestRoutes;
