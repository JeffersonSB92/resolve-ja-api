import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  AdminReportsQuery,
  AdminRequestsQuery,
} from './admin.schemas.js';

type ProviderProfileRow = {
  id: string;
  user_id: string;
  status: string;
  verified_at: string | null;
  [key: string]: unknown;
};

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

async function getProviderProfileByIdOrThrow(id: string): Promise<ProviderProfileRow> {
  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .select('*')
    .eq('id', id)
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

export async function listPendingProviders(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .select(
      'id, user_id, status, verified_at, created_at, updated_at, display_name, base_city, base_state, profiles(id, full_name, phone, avatar_url)',
    )
    .in('status', ['pending_verification', 'under_review'])
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load pending providers.',
      500,
      error,
    );
  }

  return (data ?? []) as Record<string, unknown>[];
}

export async function approveProviderProfile(
  id: string,
): Promise<ProviderProfileRow> {
  await getProviderProfileByIdOrThrow(id);

  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .update({
      status: 'active',
      verified_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to approve provider profile.',
      500,
      error,
    );
  }

  return data as ProviderProfileRow;
}

export async function rejectProviderProfile(
  id: string,
): Promise<ProviderProfileRow> {
  await getProviderProfileByIdOrThrow(id);

  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .update({
      status: 'rejected',
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to reject provider profile.',
      500,
      error,
    );
  }

  return data as ProviderProfileRow;
}

export async function suspendProviderProfile(
  id: string,
): Promise<ProviderProfileRow> {
  await getProviderProfileByIdOrThrow(id);

  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .update({
      status: 'suspended',
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to suspend provider profile.',
      500,
      error,
    );
  }

  return data as ProviderProfileRow;
}

export async function listAdminRequests(
  query: AdminRequestsQuery,
): Promise<Record<string, unknown>[]> {
  let dbQuery = supabaseAdminClient
    .from('service_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load requests.', 500, error);
  }

  return (data ?? []) as Record<string, unknown>[];
}

export async function listAdminReports(
  query: AdminReportsQuery,
): Promise<Record<string, unknown>[]> {
  let dbQuery = supabaseAdminClient
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load reports.', 500, error);
  }

  return (data ?? []) as Record<string, unknown>[];
}
