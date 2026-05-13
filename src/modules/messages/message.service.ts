import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import { CreateMessageBody } from './message.schemas.js';

type RequestRow = {
  id: string;
  requester_id: string;
  assigned_provider_id: string | null;
  accepted_quote_id: string | null;
  [key: string]: unknown;
};

type ProviderProfile = {
  id: string;
  user_id: string;
  [key: string]: unknown;
};

type MessageRow = {
  id: string;
  request_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  created_at: string;
  [key: string]: unknown;
};

type QuoteLookupConfig = {
  table: string;
  requestColumn: 'request_id' | 'service_request_id';
  providerColumn: 'provider_id' | 'provider_profile_id';
};

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

async function getRequestByIdOrThrow(requestId: string): Promise<RequestRow> {
  const { data, error } = await supabaseAdminClient
    .from('service_requests')
    .select('*')
    .eq('id', requestId)
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
      'Failed to verify request participant access.',
      500,
      error,
    );
  }

  return false;
}

async function ensureRequestParticipantAccess(
  requestId: string,
  userId: string,
  isAdmin: boolean,
): Promise<RequestRow> {
  const request = await getRequestByIdOrThrow(requestId);

  if (isAdmin || request.requester_id === userId) {
    return request;
  }

  const providerProfile = await getProviderProfileByUserId(userId);

  if (!providerProfile) {
    throw AppError.forbidden('You do not have access to this request.');
  }

  if (request.assigned_provider_id === providerProfile.id) {
    return request;
  }

  const hasQuote = await providerHasQuoteForRequest(providerProfile.id, request.id);

  if (!hasQuote) {
    throw AppError.forbidden('You do not have access to this request.');
  }

  return request;
}

export async function createRequestMessage(
  requestId: string,
  userId: string,
  isAdmin: boolean,
  payload: CreateMessageBody,
): Promise<MessageRow> {
  await ensureRequestParticipantAccess(requestId, userId, isAdmin);

  const insertPayload = {
    request_id: requestId,
    sender_id: userId,
    body: payload.body ?? null,
    attachment_path: payload.attachmentPath ?? null,
  };

  const { data, error } = await supabaseAdminClient
    .from('request_messages')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to create request message.', 500, error);
  }

  return data as MessageRow;
}

export async function listRequestMessages(
  requestId: string,
  userId: string,
  isAdmin: boolean,
): Promise<MessageRow[]> {
  await ensureRequestParticipantAccess(requestId, userId, isAdmin);

  const { data, error } = await supabaseAdminClient
    .from('request_messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load request messages.', 500, error);
  }

  return (data ?? []) as MessageRow[];
}
