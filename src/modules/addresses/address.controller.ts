import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../shared/utils/response.js';
import { AppError } from '../../shared/errors/AppError.js';
import { validateOrThrow } from '../../shared/utils/validation.js';
import {
  addressParamsSchema,
  createAddressBodySchema,
  updateAddressBodySchema,
} from './address.schemas.js';
import {
  createAddress,
  deleteUserAddress,
  getUserAddressById,
  listUserAddresses,
  updateUserAddress,
} from './address.service.js';

function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId;

  if (!userId) {
    throw AppError.unauthorized('User is not authenticated.');
  }

  return userId;
}

export async function createAddressController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const payload = validateOrThrow(createAddressBodySchema, request.body);
  const address = await createAddress(userId, payload);
  return successResponse(reply, address);
}

export async function listAddressesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const addresses = await listUserAddresses(userId);
  return successResponse(reply, addresses);
}

export async function getAddressByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const { id } = validateOrThrow(addressParamsSchema, request.params);
  const address = await getUserAddressById(userId, id);
  return successResponse(reply, address);
}

export async function updateAddressController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const { id } = validateOrThrow(addressParamsSchema, request.params);
  const payload = validateOrThrow(updateAddressBodySchema, request.body);
  const address = await updateUserAddress(userId, id, payload);
  return successResponse(reply, address);
}

export async function deleteAddressController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const userId = getAuthenticatedUserId(request);
  const { id } = validateOrThrow(addressParamsSchema, request.params);
  await deleteUserAddress(userId, id);
  return successResponse(reply, { deleted: true });
}
