import { FastifyPluginAsync } from 'fastify';
import {
  acceptQuoteController,
  createQuoteForRequestController,
  listProviderQuotesMeController,
  listQuotesByRequestController,
  withdrawQuoteController,
} from './quote.controller.js';

const quoteRoutes: FastifyPluginAsync = async (app) => {
  const protectedRoute = {
    preHandler: app.authenticate,
  };

  app.post('/requests/:id/quotes', protectedRoute, createQuoteForRequestController);
  app.get('/requests/:id/quotes', protectedRoute, listQuotesByRequestController);
  app.get('/providers/me/quotes', protectedRoute, listProviderQuotesMeController);
  app.post('/quotes/:id/withdraw', protectedRoute, withdrawQuoteController);
  app.post('/quotes/:id/accept', protectedRoute, acceptQuoteController);
};

export default quoteRoutes;
