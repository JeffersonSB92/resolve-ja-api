import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  getActiveServiceById,
  listActiveCategories,
  listActiveServices,
} from './catalog.service.js';

const listServicesQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
});

const getServiceParamsSchema = z.object({
  id: z.string().min(1),
});

export async function getCategoriesController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const categories = await listActiveCategories();
  return successResponse(reply, categories);
}

export async function getServicesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { categoryId } = validateOrThrow(listServicesQuerySchema, request.query);
  const services = await listActiveServices(categoryId);
  return successResponse(reply, services);
}

export async function getServiceByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { id } = validateOrThrow(getServiceParamsSchema, request.params);
  const service = await getActiveServiceById(id);
  return successResponse(reply, service);
}
