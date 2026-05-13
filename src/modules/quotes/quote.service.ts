import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import { CreateQuoteBody, ListProviderQuotesQuery } from './quote.schemas.js';

type ProviderProfileRow = {
  id: string;
  user_id: string;
  status: string;
  [key: string]: unknown;
};

type ServiceRequestRow = {
  id: string;
  requester_id: string;
  service_id: string;
  status: string;
  [key: string]: unknown;
};

type ProviderServiceRow = {
  provider_id: string;
  service_id: string;
  active: boolean;
  [key: string]: unknown;
};

type QuoteRow = {
  id: string;
  request_id: string;
  provider_id: string;
  amount_cents: number;
  message: string | null;
  estimated_duration_minutes: number | null;
  valid_until: string | null;
  status: string;
  created_at: string;
  [key: string]: unknown;
};

type PaymentRow = Record<string, unknown>;

type AcceptQuoteResult = {
  serviceRequest: ServiceRequestRow;
  acceptedQuote: QuoteRow;
  payment: PaymentRow | null;
};

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function extractPaymentFromAcceptRpcResult(value: unknown): PaymentRow | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const directPayment = asRecord(record.payment);
  if (directPayment) {
    return directPayment;
  }

  const nestedData = asRecord(record.data);
  if (nestedData) {
    const nestedPayment = asRecord(nestedData.payment);
    if (nestedPayment) {
      return nestedPayment;
    }
  }

  return null;
}

async function getProviderProfileByUserIdOrThrow(userId: string): Promise<ProviderProfileRow> {
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

  if (!data) {
    throw AppError.notFound('Provider profile');
  }

  return data as ProviderProfileRow;
}

async function getServiceRequestByIdOrThrow(requestId: string): Promise<ServiceRequestRow> {
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

  return data as ServiceRequestRow;
}

async function ensureProviderOffersService(
  providerId: string,
  serviceId: string,
): Promise<ProviderServiceRow> {
  const { data, error } = await supabaseAdminClient
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .eq('service_id', serviceId)
    .eq('active', true)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load provider service.',
      500,
      error,
    );
  }

  if (!data) {
    throw AppError.forbidden('Provider does not offer this service.');
  }

  return data as ProviderServiceRow;
}

async function getQuoteByRequestAndProvider(
  requestId: string,
  providerId: string,
): Promise<QuoteRow | null> {
  const { data, error } = await supabaseAdminClient
    .from('quotes')
    .select('*')
    .eq('request_id', requestId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load quote.', 500, error);
  }

  return (data as QuoteRow | null) ?? null;
}

async function getQuoteByIdOrThrow(quoteId: string): Promise<QuoteRow> {
  const { data, error } = await supabaseAdminClient
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load quote.', 500, error);
  }

  if (!data) {
    throw AppError.notFound('Quote');
  }

  return data as QuoteRow;
}

async function getLatestPaymentForQuoteOrNull(quoteId: string): Promise<PaymentRow | null> {
  const paymentTables = ['payments', 'request_payments', 'service_request_payments'];

  for (const table of paymentTables) {
    const byQuote = await supabaseAdminClient
      .from(table)
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!byQuote.error) {
      const row = (byQuote.data ?? [])[0];
      return asRecord(row);
    }

    if (isMissingDbObjectError(byQuote.error)) {
      continue;
    }

    if (byQuote.error.message.includes('quote_id')) {
      const byAcceptedQuote = await supabaseAdminClient
        .from(table)
        .select('*')
        .eq('accepted_quote_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!byAcceptedQuote.error) {
        const row = (byAcceptedQuote.data ?? [])[0];
        return asRecord(row);
      }

      if (isMissingDbObjectError(byAcceptedQuote.error)) {
        continue;
      }
    }

    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load payment.', 500, byQuote.error);
  }

  return null;
}

function toCreateQuotePayload(payload: CreateQuoteBody): Record<string, unknown> {
  return {
    amount_cents: payload.amountCents,
    message: payload.message ?? null,
    estimated_duration_minutes: payload.estimatedDurationMinutes ?? null,
    valid_until: payload.validUntil ?? null,
  };
}

export async function createQuoteForRequest(
  requestId: string,
  userId: string,
  payload: CreateQuoteBody,
): Promise<QuoteRow> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  if (providerProfile.status !== 'active') {
    throw AppError.forbidden('Provider profile must be active.');
  }

  const request = await getServiceRequestByIdOrThrow(requestId);

  if (request.status !== 'open') {
    throw AppError.conflict(
      'REQUEST_NOT_OPEN',
      'Quotes can only be sent to requests with status open.',
    );
  }

  await ensureProviderOffersService(providerProfile.id, request.service_id);

  const existingQuote = await getQuoteByRequestAndProvider(requestId, providerProfile.id);

  if (existingQuote) {
    throw AppError.conflict(
      'QUOTE_ALREADY_EXISTS',
      'Provider already sent a quote for this request.',
    );
  }

  const insertPayload = {
    request_id: requestId,
    provider_id: providerProfile.id,
    status: 'sent',
    ...toCreateQuotePayload(payload),
  };

  const { data, error } = await supabaseAdminClient
    .from('quotes')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to create quote.', 500, error);
  }

  return data as QuoteRow;
}

export async function listQuotesByRequest(
  requestId: string,
  userId: string,
  isAdmin: boolean,
): Promise<QuoteRow[]> {
  const request = await getServiceRequestByIdOrThrow(requestId);

  if (isAdmin || request.requester_id === userId) {
    const { data, error } = await supabaseAdminClient
      .from('quotes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load quotes.', 500, error);
    }

    return (data ?? []) as QuoteRow[];
  }

  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  const ownQuote = await getQuoteByRequestAndProvider(requestId, providerProfile.id);

  if (!ownQuote) {
    throw AppError.forbidden('You do not have access to these quotes.');
  }

  return [ownQuote];
}

export async function listProviderQuotesMe(
  userId: string,
  query: ListProviderQuotesQuery,
): Promise<QuoteRow[]> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  let dbQuery = supabaseAdminClient
    .from('quotes')
    .select('*')
    .eq('provider_id', providerProfile.id)
    .order('created_at', { ascending: false });

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load provider quotes.', 500, error);
  }

  return (data ?? []) as QuoteRow[];
}

export async function withdrawQuote(
  quoteId: string,
  userId: string,
): Promise<QuoteRow> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);
  const quote = await getQuoteByIdOrThrow(quoteId);

  if (quote.provider_id !== providerProfile.id) {
    throw AppError.forbidden('Only the quote owner can withdraw it.');
  }

  if (quote.status !== 'sent') {
    throw AppError.conflict('QUOTE_WITHDRAW_NOT_ALLOWED', 'Only sent quotes can be withdrawn.');
  }

  const { data, error } = await supabaseAdminClient
    .from('quotes')
    .update({ status: 'withdrawn' })
    .eq('id', quoteId)
    .eq('provider_id', providerProfile.id)
    .eq('status', 'sent')
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to withdraw quote.', 500, error);
  }

  return data as QuoteRow;
}

export async function acceptQuote(
  quoteId: string,
  userId: string,
  providerProfileId: string | null,
): Promise<AcceptQuoteResult> {
  const quote = await getQuoteByIdOrThrow(quoteId);
  const request = await getServiceRequestByIdOrThrow(quote.request_id);

  if (request.requester_id !== userId) {
    throw AppError.forbidden('Only the request owner can accept this quote.');
  }

  if (providerProfileId && providerProfileId === quote.provider_id) {
    throw AppError.forbidden('Provider cannot accept their own quote.');
  }

  if (request.status !== 'open') {
    throw AppError.conflict(
      'REQUEST_NOT_OPEN',
      'Only requests with status open can accept quotes.',
    );
  }

  if (quote.status !== 'sent') {
    throw AppError.conflict(
      'QUOTE_NOT_ACCEPTABLE',
      'Only quotes with status sent can be accepted.',
    );
  }

  const { data: rpcData, error: rpcError } = await supabaseAdminClient.rpc('accept_quote', {
    p_quote_id: quoteId,
  });

  if (rpcError) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to accept quote.', 500, rpcError);
  }

  const updatedRequest = await getServiceRequestByIdOrThrow(request.id);
  const acceptedQuote = await getQuoteByIdOrThrow(quote.id);
  const payment =
    extractPaymentFromAcceptRpcResult(rpcData) ??
    (await getLatestPaymentForQuoteOrNull(quote.id));

  return {
    serviceRequest: updatedRequest,
    acceptedQuote,
    payment,
  };
}
