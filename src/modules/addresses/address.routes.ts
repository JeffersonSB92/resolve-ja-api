import { FastifyPluginAsync } from 'fastify';
import {
  createAddressController,
  deleteAddressController,
  getAddressByIdController,
  listAddressesController,
  updateAddressController,
} from './address.controller.js';

const addressRoutes: FastifyPluginAsync = async (app) => {
  const protectedRoute = {
    preHandler: app.authenticate,
  };

  app.post('/addresses', protectedRoute, createAddressController);
  app.get('/addresses', protectedRoute, listAddressesController);
  app.get('/addresses/:id', protectedRoute, getAddressByIdController);
  app.patch('/addresses/:id', protectedRoute, updateAddressController);
  app.delete('/addresses/:id', protectedRoute, deleteAddressController);
};

export default addressRoutes;
