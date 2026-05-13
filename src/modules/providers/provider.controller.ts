import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/AppError.js';
import { createdResponse, successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  createProviderProfileBodySchema,
  createProviderServiceBodySchema,
  listAvailableRequestsQuerySchema,
  providerServiceParamsSchema,
  updateProviderProfileBodySchema,
  updateProviderServiceBodySchema,
} from './provider.schemas.js';
import {
  createProviderProfile,
  createProviderServiceMe,
  deleteProviderServiceMe,
  getProviderProfileMe,
  listAvailableRequestsMe,
  listProviderServicesMe,
  updateProviderProfileMe,
  updateProviderServiceMe,
} from './provider.service.js';

function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId;

  if (!userId) {
    throw AppError.unauthorized('User is not authenticated.');
  }

  return userId;
}

export async function createProviderProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const payload = validateOrThrow(createProviderProfileBodySchema, request.body);
  const profile = await createProviderProfile(userId, payload);
  return createdResponse(reply, profile);
}

export async function getProviderProfileMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const profile = await getProviderProfileMe(userId);
  return successResponse(reply, profile);
}

export async function updateProviderProfileMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const payload = validateOrThrow(updateProviderProfileBodySchema, request.body);
  const profile = await updateProviderProfileMe(userId, payload);
  return successResponse(reply, profile);
}

export async function createProviderServiceMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const payload = validateOrThrow(createProviderServiceBodySchema, request.body);
  const providerService = await createProviderServiceMe(userId, payload);
  return createdResponse(reply, providerService);
}

export async function listProviderServicesMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const providerServices = await listProviderServicesMe(userId);
  return successResponse(reply, providerServices);
}

export async function updateProviderServiceMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const { serviceId } = validateOrThrow(providerServiceParamsSchema, request.params);
  const payload = validateOrThrow(updateProviderServiceBodySchema, request.body);
  const providerService = await updateProviderServiceMe(userId, serviceId, payload);
  return successResponse(reply, providerService);
}

export async function deleteProviderServiceMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const { serviceId } = validateOrThrow(providerServiceParamsSchema, request.params);
  await deleteProviderServiceMe(userId, serviceId);
  return successResponse(reply, { deleted: true });
}

export async function listAvailableRequestsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const query = validateOrThrow(listAvailableRequestsQuerySchema, request.query);
  const availableRequests = await listAvailableRequestsMe(userId, query);
  return successResponse(reply, availableRequests);
}
