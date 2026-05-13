import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors/AppError.js';
import { createdResponse, successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  createQuoteBodySchema,
  listProviderQuotesQuerySchema,
  quoteIdParamsSchema,
  requestQuoteParamsSchema,
} from './quote.schemas.js';
import {
  acceptQuote,
  createQuoteForRequest,
  listProviderQuotesMe,
  listQuotesByRequest,
  withdrawQuote,
} from './quote.service.js';

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

export async function createQuoteForRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(requestQuoteParamsSchema, request.params);
  const payload = validateOrThrow(createQuoteBodySchema, request.body);
  const quote = await createQuoteForRequest(id, userId, payload);
  return createdResponse(reply, quote);
}

export async function listQuotesByRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId, isAdmin } = getAuthContext(request);
  const { id } = validateOrThrow(requestQuoteParamsSchema, request.params);
  const quotes = await listQuotesByRequest(id, userId, isAdmin);
  return successResponse(reply, quotes);
}

export async function listProviderQuotesMeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const query = validateOrThrow(listProviderQuotesQuerySchema, request.query);
  const quotes = await listProviderQuotesMe(userId, query);
  return successResponse(reply, quotes);
}

export async function withdrawQuoteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(quoteIdParamsSchema, request.params);
  const quote = await withdrawQuote(id, userId);
  return successResponse(reply, quote);
}

export async function acceptQuoteController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { userId } = getAuthContext(request);
  const { id } = validateOrThrow(quoteIdParamsSchema, request.params);
  const accepted = await acceptQuote(id, userId, request.auth?.providerProfile?.id ?? null);
  return successResponse(reply, accepted);
}
