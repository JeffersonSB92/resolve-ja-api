import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/AppError.js';
import { createdResponse, successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  cancelRequestBodySchema,
  createRequestBodySchema,
  generateStartPinBodySchema,
  listMyRequestsQuerySchema,
  requestCheckInBodySchema,
  requestIdParamsSchema,
  startServiceBodySchema,
  updateRequestBodySchema,
} from './request.schemas.js';
import {
  checkInRequestAsProvider,
  cancelRequest,
  confirmRequestCompletion,
  createRequest,
  generateRequestStartPin,
  getRequestById,
  listMyRequests,
  markRequestAsDone,
  startRequestWithPin,
  updateRequest,
} from './request.service.js';

function getAuthContext(request: FastifyRequest): { userId: string; isAdmin: boolean } {
  const userId = request.auth?.userId;

  if (!userId) {
    throw AppError.unauthorized('User is not authenticated.');
  }

  return {
    userId,
    isAdmin: request.auth?.isAdmin === true,
  };
}

export async function createRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const payload = validateOrThrow(createRequestBodySchema, request.body);
  const created = await createRequest(userId, payload);
  return createdResponse(reply, created);
}

export async function listMyRequestsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const query = validateOrThrow(listMyRequestsQuerySchema, request.query);
  const requests = await listMyRequests(userId, query);
  return successResponse(reply, requests);
}

export async function getRequestByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId, isAdmin } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const serviceRequest = await getRequestById(id, userId, isAdmin);
  return successResponse(reply, serviceRequest);
}

export async function updateRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const payload = validateOrThrow(updateRequestBodySchema, request.body);
  const updated = await updateRequest(id, userId, payload);
  return successResponse(reply, updated);
}

export async function cancelRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const payload = validateOrThrow(cancelRequestBodySchema, request.body);
  const canceled = await cancelRequest(id, userId, payload);
  return successResponse(reply, canceled);
}

export async function checkInRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const payload = validateOrThrow(requestCheckInBodySchema, request.body);
  const updated = await checkInRequestAsProvider(id, userId, payload);
  return successResponse(reply, updated);
}

export async function generateStartPinController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  validateOrThrow(generateStartPinBodySchema, request.body ?? {});
  const result = await generateRequestStartPin(id, userId);
  return successResponse(reply, result);
}

export async function startRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const payload = validateOrThrow(startServiceBodySchema, request.body);
  const updated = await startRequestWithPin(id, userId, payload);
  return successResponse(reply, updated);
}

export async function markDoneRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const updated = await markRequestAsDone(id, userId);
  return successResponse(reply, updated);
}

export async function confirmCompletionRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestIdParamsSchema, request.params);
  const updated = await confirmRequestCompletion(id, userId);
  return successResponse(reply, updated);
}
