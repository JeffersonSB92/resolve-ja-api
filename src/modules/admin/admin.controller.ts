import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../shared/utils/response.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  adminProviderParamsSchema,
  adminReportsQuerySchema,
  adminRequestsQuerySchema,
  approveProviderBodySchema,
  rejectProviderBodySchema,
  suspendProviderBodySchema,
} from './admin.schemas.js';
import {
  approveProviderProfile,
  listAdminReports,
  listAdminRequests,
  listPendingProviders,
  rejectProviderProfile,
  suspendProviderProfile,
} from './admin.service.js';

export async function listPendingProvidersController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const providers = await listPendingProviders();
  return successResponse(reply, providers);
}

export async function approveProviderController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { id } = validateOrThrow(adminProviderParamsSchema, request.params);
  validateOrThrow(approveProviderBodySchema, request.body ?? {});
  const provider = await approveProviderProfile(id);
  return successResponse(reply, provider);
}

export async function rejectProviderController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { id } = validateOrThrow(adminProviderParamsSchema, request.params);
  validateOrThrow(rejectProviderBodySchema, request.body ?? {});
  const provider = await rejectProviderProfile(id);
  return successResponse(reply, provider);
}

export async function suspendProviderController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { id } = validateOrThrow(adminProviderParamsSchema, request.params);
  validateOrThrow(suspendProviderBodySchema, request.body ?? {});
  const provider = await suspendProviderProfile(id);
  return successResponse(reply, provider);
}

export async function listAdminRequestsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const query = validateOrThrow(adminRequestsQuerySchema, request.query);
  const requests = await listAdminRequests(query);
  return successResponse(reply, requests);
}

export async function listAdminReportsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const query = validateOrThrow(adminReportsQuerySchema, request.query);
  const reports = await listAdminReports(query);
  return successResponse(reply, reports);
}
