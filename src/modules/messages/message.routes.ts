import { FastifyPluginAsync } from 'fastify';
import {
  createRequestMessageController,
  listRequestMessagesController,
} from './message.controller.js';

const messageRoutes: FastifyPluginAsync = async (app) => {
  const protectedRoute = {
    preHandler: app.authenticate,
  };

  app.post('/requests/:id/messages', protectedRoute, createRequestMessageController);
  app.get('/requests/:id/messages', protectedRoute, listRequestMessagesController);
};

export default messageRoutes;
