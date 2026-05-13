import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  CancelRequestBody,
  CreateRequestBody,
  ListMyRequestsQuery,
  RequestCheckInBody,
  StartServiceBody,
  UpdateRequestBody,
} from './request.schemas.js';

type RequestRow = {
  id: string;
  requester_id: string;
  service_id: string;
  address_id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_provider_id: string | null;
  accepted_quote_id: string | null;
  desired_start_at: string | null;
  desired_end_at: string | null;
  budget_cents: number | null;
  location_state: string | null;
  location_city: string | null;
  location_neighborhood: string | null;
  cancelled_at: string | null;
  created_at: string;
  [key: string]: unknown;
};

type ServiceRow = {
  id: string;
  active: boolean;
  [key: string]: unknown;
};

type AddressRow = {
  id: string;
  user_id: string;
  state: string;
  city: string;
  neighborhood: string | null;
  [key: string]: unknown;
};

type ProviderProfile = {
  id: string;
  user_id: string;
  status?: string;
  [key: string]: unknown;
};

type QuoteLookupConfig = {
  table: string;
  requestColumn: 'request_id' | 'service_request_id';
  providerColumn: 'provider_id' | 'provider_profile_id';
};

const CANCELABLE_STATUSES = new Set([
  'open',
  'scheduled',
  'provider_arrived',
  'awaiting_pin',
]);

const QUOTE_LOOKUP_CONFIGS: QuoteLookupConfig[] = [
  {
    table: 'service_request_quotes',
    requestColumn: 'request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'service_request_quotes',
    requestColumn: 'service_request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'request_quotes',
    requestColumn: 'request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'request_quotes',
    requestColumn: 'service_request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'quotes',
    requestColumn: 'request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'quotes',
    requestColumn: 'service_request_id',
    providerColumn: 'provider_id',
  },
  {
    table: 'service_request_quotes',
    requestColumn: 'request_id',
    providerColumn: 'provider_profile_id',
  },
  {
    table: 'request_quotes',
    requestColumn: 'request_id',
    providerColumn: 'provider_profile_id',
  },
];

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function isMissingDbObjectError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find');
}

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === '42883' || error.code === 'PGRST202') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return message.includes('function') && message.includes('not');
}

function throwRpcError(
  error: { code?: string; message?: string } | null,
  fallbackMessage: string,
): never {
  if (error?.code === 'P0001') {
    throw AppError.badRequest('RPC_BUSINESS_RULE_VIOLATION', error.message || fallbackMessage);
  }

  throw new AppError('INTERNAL_SERVER_ERROR', fallbackMessage, 500, error);
}

function toCreateRequestPayload(payload: CreateRequestBody): Record<string, unknown> {
  return {
    service_id: payload.serviceId,
    address_id: payload.addressId,
    title: payload.title,
    description: payload.description ?? null,
    desired_start_at: payload.desiredStartAt ?? null,
    desired_end_at: payload.desiredEndAt ?? null,
    budget_cents: payload.budgetCents ?? null,
  };
}

function toUpdateRequestPayload(payload: UpdateRequestBody): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if ('title' in payload) updates.title = payload.title;
  if ('description' in payload) updates.description = payload.description ?? null;
  if ('desiredStartAt' in payload) updates.desired_start_at = payload.desiredStartAt ?? null;
  if ('desiredEndAt' in payload) updates.desired_end_at = payload.desiredEndAt ?? null;
  if ('budgetCents' in payload) updates.budget_cents = payload.budgetCents;

  return updates;
}

function maskRequestForNonContractedProvider(request: RequestRow): RequestRow {
  const masked: RequestRow = {
    ...request,
    address_id: '',
    location_neighborhood: null,
  };

  const sensitiveKeys = [
    'location_street',
    'location_number',
    'location_complement',
    'location_postal_code',
    'street',
    'number',
    'complement',
    'postal_code',
  ];

  for (const key of sensitiveKeys) {
    if (key in masked) {
      masked[key] = null;
    }
  }

  return masked;
}

async function getActiveServiceById(serviceId: string): Promise<ServiceRow> {
  const { data, error } = await supabaseAdminClient
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('active', true)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load service.', 500, error);
  }

  if (!data) {
    throw AppError.notFound('Service');
  }

  return data as ServiceRow;
}

async function getOwnedAddressById(userId: string, addressId: string): Promise<AddressRow> {
  const { data, error } = await supabaseAdminClient
    .from('user_addresses')
    .select('*')
    .eq('id', addressId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load address.', 500, error);
  }

  if (!data) {
    throw AppError.notFound('Address');
  }

  return data as AddressRow;
}

async function getProviderProfileByUserId(userId: string): Promise<ProviderProfile | null> {
  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load provider profile.',
      500,
      error,
    );
  }

  return (data as ProviderProfile | null) ?? null;
}

async function getRequestByIdOrThrow(id: string): Promise<RequestRow> {
  const { data, error } = await supabaseAdminClient
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load service request.',
      500,
      error,
    );
  }

  if (!data) {
    throw AppError.notFound('Service request');
  }

  return data as RequestRow;
}

async function providerHasQuoteForRequest(
  providerId: string,
  requestId: string,
): Promise<boolean> {
  for (const config of QUOTE_LOOKUP_CONFIGS) {
    const { data, error } = await supabaseAdminClient
      .from(config.table)
      .select('id')
      .eq(config.requestColumn, requestId)
      .eq(config.providerColumn, providerId)
      .limit(1);

    if (!error) {
      return (data ?? []).length > 0;
    }

    if (isMissingDbObjectError(error)) {
      continue;
    }

    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to verify provider quote access.',
      500,
      error,
    );
  }

  return false;
}

async function providerOwnsQuoteId(
  providerId: string,
  quoteId: string,
): Promise<boolean> {
  for (const config of QUOTE_LOOKUP_CONFIGS) {
    const { data, error } = await supabaseAdminClient
      .from(config.table)
      .select('id')
      .eq('id', quoteId)
      .eq(config.providerColumn, providerId)
      .limit(1);

    if (!error) {
      return (data ?? []).length > 0;
    }

    if (isMissingDbObjectError(error)) {
      continue;
    }

    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to verify accepted quote ownership.',
      500,
      error,
    );
  }

  return false;
}

async function canViewerAccessRequest(
  request: RequestRow,
  userId: string,
  isAdmin: boolean,
): Promise<{ canAccess: boolean; viaProvider: boolean; providerIsContracted: boolean }> {
  if (isAdmin || request.requester_id === userId) {
    return { canAccess: true, viaProvider: false, providerIsContracted: false };
  }

  const providerProfile = await getProviderProfileByUserId(userId);

  if (!providerProfile) {
    return { canAccess: false, viaProvider: false, providerIsContracted: false };
  }

  if (request.assigned_provider_id === providerProfile.id) {
    return { canAccess: true, viaProvider: true, providerIsContracted: true };
  }

  const hasQuote = await providerHasQuoteForRequest(providerProfile.id, request.id);

  if (!hasQuote) {
    return { canAccess: false, viaProvider: false, providerIsContracted: false };
  }

  const providerOwnsAcceptedQuote =
    request.accepted_quote_id !== null
      ? await providerOwnsQuoteId(providerProfile.id, request.accepted_quote_id)
      : false;

  return {
    canAccess: true,
    viaProvider: true,
    providerIsContracted: providerOwnsAcceptedQuote,
  };
}

async function tryCancelRequestWithRpc(
  requestId: string,
  userId: string,
  reason?: string,
): Promise<{ executed: boolean }> {
  const payloads: Record<string, unknown>[] = [
    { request_id: requestId, requester_id: userId, reason: reason ?? null },
    { request_id: requestId, user_id: userId, reason: reason ?? null },
    { p_request_id: requestId, p_user_id: userId, p_reason: reason ?? null },
  ];

  let missingRpc = false;

  for (const payload of payloads) {
    const { error } = await supabaseAdminClient.rpc('cancel_service_request', payload);

    if (!error) {
      return { executed: true };
    }

    if (isMissingRpcError(error)) {
      missingRpc = true;
      continue;
    }

    if (error.code === 'P0001') {
      throw AppError.badRequest('CANCEL_NOT_ALLOWED', error.message);
    }

    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to cancel service request.', 500, error);
  }

  return { executed: !missingRpc };
}

export async function createRequest(
  userId: string,
  payload: CreateRequestBody,
): Promise<RequestRow> {
  await getActiveServiceById(payload.serviceId);
  const address = await getOwnedAddressById(userId, payload.addressId);

  const insertPayload = {
    ...toCreateRequestPayload(payload),
    requester_id: userId,
    status: 'open',
    location_state: address.state,
    location_city: address.city,
    location_neighborhood: address.neighborhood,
  };

  const { data, error } = await supabaseAdminClient
    .from('service_requests')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to create service request.', 500, error);
  }

  return data as RequestRow;
}

export async function listMyRequests(
  userId: string,
  query: ListMyRequestsQuery,
): Promise<RequestRow[]> {
  let dbQuery = supabaseAdminClient
    .from('service_requests')
    .select('*')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load service requests.', 500, error);
  }

  return (data ?? []) as RequestRow[];
}

export async function getRequestById(
  id: string,
  userId: string,
  isAdmin: boolean,
): Promise<RequestRow> {
  const request = await getRequestByIdOrThrow(id);
  const access = await canViewerAccessRequest(request, userId, isAdmin);

  if (!access.canAccess) {
    throw AppError.forbidden('You do not have access to this service request.');
  }

  if (access.viaProvider && !access.providerIsContracted) {
    return maskRequestForNonContractedProvider(request);
  }

  return request;
}

export async function updateRequest(
  id: string,
  userId: string,
  payload: UpdateRequestBody,
): Promise<RequestRow> {
  const current = await getRequestByIdOrThrow(id);

  if (current.requester_id !== userId) {
    throw AppError.forbidden('Only the request owner can edit this service request.');
  }

  if (current.status !== 'open') {
    throw AppError.conflict(
      'REQUEST_NOT_EDITABLE',
      'Only requests with status open can be edited.',
    );
  }

  const nextDesiredStartAt =
    payload.desiredStartAt !== undefined ? payload.desiredStartAt : current.desired_start_at;
  const nextDesiredEndAt =
    payload.desiredEndAt !== undefined ? payload.desiredEndAt : current.desired_end_at;

  if (nextDesiredStartAt && nextDesiredEndAt) {
    const startAt = new Date(nextDesiredStartAt);
    const endAt = new Date(nextDesiredEndAt);

    if (endAt < startAt) {
      throw AppError.badRequest(
        'INVALID_DATE_RANGE',
        'desiredEndAt cannot be before desiredStartAt.',
      );
    }
  }

  const updates = toUpdateRequestPayload(payload);

  const { data, error } = await supabaseAdminClient
    .from('service_requests')
    .update(updates)
    .eq('id', id)
    .eq('requester_id', userId)
    .eq('status', 'open')
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to update service request.', 500, error);
  }

  return data as RequestRow;
}

export async function cancelRequest(
  id: string,
  userId: string,
  payload: CancelRequestBody,
): Promise<RequestRow> {
  const current = await getRequestByIdOrThrow(id);

  if (current.requester_id !== userId) {
    throw AppError.forbidden('Only the request owner can cancel this service request.');
  }

  const rpcResult = await tryCancelRequestWithRpc(id, userId, payload.reason);

  if (rpcResult.executed) {
    return getRequestByIdOrThrow(id);
  }

  if (!CANCELABLE_STATUSES.has(current.status)) {
    throw AppError.conflict(
      'REQUEST_NOT_CANCELABLE',
      'Request cannot be canceled in the current status.',
    );
  }

  const updates: Record<string, unknown> = {
    status: 'canceled',
    cancelled_at: new Date().toISOString(),
  };

  if (payload.reason) {
    updates.cancel_reason = payload.reason;
  }

  const { data, error } = await supabaseAdminClient
    .from('service_requests')
    .update(updates)
    .eq('id', id)
    .eq('requester_id', userId)
    .in('status', Array.from(CANCELABLE_STATUSES))
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to cancel service request.', 500, error);
  }

  return data as RequestRow;
}

export async function checkInRequestAsProvider(
  id: string,
  userId: string,
  payload: RequestCheckInBody,
): Promise<RequestRow> {
  const providerProfile = await getProviderProfileByUserId(userId);

  if (!providerProfile) {
    throw AppError.notFound('Provider profile');
  }

  const request = await getRequestByIdOrThrow(id);

  if (request.assigned_provider_id !== providerProfile.id) {
    throw AppError.forbidden('Only the assigned provider can check in.');
  }

  if (request.status !== 'scheduled') {
    throw AppError.conflict(
      'REQUEST_NOT_SCHEDULED',
      'Request must be scheduled before provider check-in.',
    );
  }

  const { error } = await supabaseAdminClient.rpc('mark_provider_arrived', {
    p_request_id: id,
    p_selfie_path: payload.selfiePath,
    p_lat: payload.lat ?? null,
    p_lng: payload.lng ?? null,
  });

  if (error) {
    throwRpcError(error, 'Failed to mark provider as arrived.');
  }

  return getRequestByIdOrThrow(id);
}

export async function generateRequestStartPin(
  id: string,
  userId: string,
): Promise<{ pin: string }> {
  const request = await getRequestByIdOrThrow(id);

  if (request.requester_id !== userId) {
    throw AppError.forbidden('Only the request owner can generate the start PIN.');
  }

  if (request.status !== 'scheduled' && request.status !== 'provider_arrived') {
    throw AppError.conflict(
      'REQUEST_STATUS_INVALID_FOR_PIN',
      'Request must be scheduled or provider_arrived to generate a PIN.',
    );
  }

  const { data, error } = await supabaseAdminClient.rpc('generate_start_pin', {
    p_request_id: id,
  });

  if (error) {
    throwRpcError(error, 'Failed to generate start PIN.');
  }

  if (typeof data === 'string' && data.trim().length > 0) {
    return { pin: data };
  }

  if (typeof data === 'number' && Number.isFinite(data)) {
    return { pin: String(Math.trunc(data)) };
  }

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const candidate =
      typeof record.pin === 'string'
        ? record.pin
        : typeof record.start_pin === 'string'
          ? record.start_pin
          : typeof record.generated_pin === 'string'
            ? record.generated_pin
            : null;

    if (candidate && candidate.trim().length > 0) {
      return { pin: candidate };
    }
  }

  throw new AppError(
    'INTERNAL_SERVER_ERROR',
    'Start PIN was not returned by RPC.',
    500,
    data,
  );
}

export async function startRequestWithPin(
  id: string,
  userId: string,
  payload: StartServiceBody,
): Promise<RequestRow> {
  const providerProfile = await getProviderProfileByUserId(userId);

  if (!providerProfile) {
    throw AppError.notFound('Provider profile');
  }

  const request = await getRequestByIdOrThrow(id);

  if (request.assigned_provider_id !== providerProfile.id) {
    throw AppError.forbidden('Only the assigned provider can start this request.');
  }

  const { error } = await supabaseAdminClient.rpc('start_service_with_pin', {
    p_request_id: id,
    p_pin: payload.pin,
  });

  if (error) {
    throwRpcError(error, 'Failed to start service with PIN.');
  }

  return getRequestByIdOrThrow(id);
}

export async function markRequestAsDone(
  id: string,
  userId: string,
): Promise<RequestRow> {
  const providerProfile = await getProviderProfileByUserId(userId);

  if (!providerProfile) {
    throw AppError.notFound('Provider profile');
  }

  const request = await getRequestByIdOrThrow(id);

  if (request.assigned_provider_id !== providerProfile.id) {
    throw AppError.forbidden('Only the assigned provider can mark this request as done.');
  }

  if (request.status !== 'in_progress') {
    throw AppError.conflict(
      'REQUEST_NOT_IN_PROGRESS',
      'Request must be in_progress to mark as done.',
    );
  }

  const { error } = await supabaseAdminClient.rpc('mark_service_done', {
    p_request_id: id,
  });

  if (error) {
    throwRpcError(error, 'Failed to mark service as done.');
  }

  return getRequestByIdOrThrow(id);
}

export async function confirmRequestCompletion(
  id: string,
  userId: string,
): Promise<RequestRow> {
  const request = await getRequestByIdOrThrow(id);

  if (request.requester_id !== userId) {
    throw AppError.forbidden('Only the request owner can confirm completion.');
  }

  if (request.status !== 'in_progress' && request.status !== 'pending_confirmation') {
    throw AppError.conflict(
      'REQUEST_STATUS_INVALID_FOR_COMPLETION',
      'Request must be in_progress or pending_confirmation to confirm completion.',
    );
  }

  const { error } = await supabaseAdminClient.rpc('confirm_service_completed', {
    p_request_id: id,
  });

  if (error) {
    throwRpcError(error, 'Failed to confirm service completion.');
  }

  return getRequestByIdOrThrow(id);
}
