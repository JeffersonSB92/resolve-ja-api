import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/AppError.js';
import { createdResponse, successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  createMessageBodySchema,
  requestMessageParamsSchema,
} from './message.schemas.js';
import { createRequestMessage, listRequestMessages } from './message.service.js';

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

export async function createRequestMessageController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId, isAdmin } = getAuthContext(request);
  const { id } = validateOrThrow(requestMessageParamsSchema, request.params);
  const payload = validateOrThrow(createMessageBodySchema, request.body);
  const message = await createRequestMessage(id, userId, isAdmin, payload);
  return createdResponse(reply, message);
}

export async function listRequestMessagesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId, isAdmin } = getAuthContext(request);
  const { id } = validateOrThrow(requestMessageParamsSchema, request.params);
  const messages = await listRequestMessages(id, userId, isAdmin);
  return successResponse(reply, messages);
}
