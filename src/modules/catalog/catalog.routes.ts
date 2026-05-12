import { FastifyPluginAsync } from 'fastify';
import {
  getCategoriesController,
  getServiceByIdController,
  getServicesController,
} from './catalog.controller.js';

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/categories', getCategoriesController);
  app.get('/services', getServicesController);
  app.get('/services/:id', getServiceByIdController);
};

export default catalogRoutes;
