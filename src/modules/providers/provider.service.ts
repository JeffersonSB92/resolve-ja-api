import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  CreateProviderProfileBody,
  CreateProviderServiceBody,
  ListAvailableRequestsQuery,
  UpdateProviderProfileBody,
  UpdateProviderServiceBody,
} from './provider.schemas.js';

type ProviderProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  base_state: string;
  base_city: string;
  base_neighborhood: string | null;
  service_radius_km: number | null;
  status: string;
  verified_at: string | null;
  average_rating: number | null;
  rating_count: number | null;
  [key: string]: unknown;
};

type ServiceRow = {
  id: string;
  active: boolean;
  [key: string]: unknown;
};

type ProviderServiceRow = {
  id: string;
  provider_id: string;
  service_id: string;
  base_price_cents: number | null;
  price_notes: string | null;
  active: boolean;
  [key: string]: unknown;
};

type AvailableRequestRow = {
  id: string;
  title: string;
  description: string | null;
  service: {
    id: string;
    name: string | null;
    description: string | null;
  };
  locationState: string | null;
  locationCity: string | null;
  locationNeighborhood: string | null;
  desiredStartAt: string | null;
  desiredEndAt: string | null;
  budgetCents: number | null;
  createdAt: string;
};

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function toProviderProfilePayload(
  payload: CreateProviderProfileBody | UpdateProviderProfileBody,
): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {};

  if ('displayName' in payload) dbPayload.display_name = payload.displayName;
  if ('bio' in payload) dbPayload.bio = payload.bio ?? null;
  if ('baseState' in payload) dbPayload.base_state = payload.baseState;
  if ('baseCity' in payload) dbPayload.base_city = payload.baseCity;
  if ('baseNeighborhood' in payload) {
    dbPayload.base_neighborhood = payload.baseNeighborhood ?? null;
  }
  if ('serviceRadiusKm' in payload) {
    dbPayload.service_radius_km = payload.serviceRadiusKm;
  }

  return dbPayload;
}

function toProviderServicePayload(
  payload: CreateProviderServiceBody | UpdateProviderServiceBody,
): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {};

  if ('basePriceCents' in payload) {
    dbPayload.base_price_cents = payload.basePriceCents ?? null;
  }

  if ('priceNotes' in payload) {
    dbPayload.price_notes = payload.priceNotes ?? null;
  }

  if ('active' in payload) {
    dbPayload.active = payload.active;
  }

  return dbPayload;
}

async function getProviderProfileByUserIdOrNull(
  userId: string,
): Promise<ProviderProfileRow | null> {
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

  return (data as ProviderProfileRow | null) ?? null;
}

async function getOwnedProviderProfileById(
  userId: string,
  id: string,
): Promise<ProviderProfileRow> {
  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .select('*')
    .eq('id', id)
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

async function getProviderProfileByUserIdOrThrow(
  userId: string,
): Promise<ProviderProfileRow> {
  const profile = await getProviderProfileByUserIdOrNull(userId);

  if (!profile) {
    throw AppError.notFound('Provider profile');
  }

  await getOwnedProviderProfileById(userId, profile.id);

  return profile;
}

function assertProviderIsActive(profile: ProviderProfileRow): void {
  if (profile.status !== 'active') {
    throw AppError.forbidden('Provider profile must be active.');
  }
}

async function ensureActiveServiceExists(serviceId: string): Promise<ServiceRow> {
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

async function getProviderServiceByProviderAndServiceIdOrNull(
  providerId: string,
  serviceId: string,
): Promise<ProviderServiceRow | null> {
  const { data, error } = await supabaseAdminClient
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load provider service.',
      500,
      error,
    );
  }

  return (data as ProviderServiceRow | null) ?? null;
}

export async function createProviderProfile(
  userId: string,
  payload: CreateProviderProfileBody,
): Promise<ProviderProfileRow> {
  const existingProfile = await getProviderProfileByUserIdOrNull(userId);

  if (existingProfile) {
    throw AppError.conflict(
      'PROVIDER_PROFILE_ALREADY_EXISTS',
      'User already has a provider profile.',
    );
  }

  const insertPayload = {
    ...toProviderProfilePayload(payload),
    user_id: userId,
    status: 'pending_verification',
  };

  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to create provider profile.',
      500,
      error,
    );
  }

  return data as ProviderProfileRow;
}

export async function getProviderProfileMe(userId: string): Promise<ProviderProfileRow> {
  const profile = await getProviderProfileByUserIdOrNull(userId);

  if (!profile) {
    throw AppError.notFound('Provider profile');
  }

  return profile;
}

export async function updateProviderProfileMe(
  userId: string,
  payload: UpdateProviderProfileBody,
): Promise<ProviderProfileRow> {
  const currentProfile = await getProviderProfileByUserIdOrNull(userId);

  if (!currentProfile) {
    throw AppError.notFound('Provider profile');
  }

  await getOwnedProviderProfileById(userId, currentProfile.id);

  const updates = toProviderProfilePayload(payload);

  const { data, error } = await supabaseAdminClient
    .from('provider_profiles')
    .update(updates)
    .eq('id', currentProfile.id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to update provider profile.',
      500,
      error,
    );
  }

  return data as ProviderProfileRow;
}

export async function createProviderServiceMe(
  userId: string,
  payload: CreateProviderServiceBody,
): Promise<ProviderServiceRow> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  await ensureActiveServiceExists(payload.serviceId);

  const existingProviderService = await getProviderServiceByProviderAndServiceIdOrNull(
    providerProfile.id,
    payload.serviceId,
  );

  if (existingProviderService) {
    throw AppError.conflict(
      'PROVIDER_SERVICE_ALREADY_EXISTS',
      'Service is already linked to this provider.',
    );
  }

  const insertPayload = {
    provider_id: providerProfile.id,
    service_id: payload.serviceId,
    ...toProviderServicePayload(payload),
  };

  const { data, error } = await supabaseAdminClient
    .from('provider_services')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to create provider service.',
      500,
      error,
    );
  }

  return data as ProviderServiceRow;
}

export async function listProviderServicesMe(userId: string): Promise<ProviderServiceRow[]> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  const { data, error } = await supabaseAdminClient
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerProfile.id);

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load provider services.',
      500,
      error,
    );
  }

  return (data ?? []) as ProviderServiceRow[];
}

export async function updateProviderServiceMe(
  userId: string,
  serviceId: string,
  payload: UpdateProviderServiceBody,
): Promise<ProviderServiceRow> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  await ensureActiveServiceExists(serviceId);

  const existingProviderService = await getProviderServiceByProviderAndServiceIdOrNull(
    providerProfile.id,
    serviceId,
  );

  if (!existingProviderService) {
    throw AppError.notFound('Provider service');
  }

  const updates = toProviderServicePayload(payload);

  const { data, error } = await supabaseAdminClient
    .from('provider_services')
    .update(updates)
    .eq('provider_id', providerProfile.id)
    .eq('service_id', serviceId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to update provider service.',
      500,
      error,
    );
  }

  return data as ProviderServiceRow;
}

export async function deleteProviderServiceMe(
  userId: string,
  serviceId: string,
): Promise<void> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);

  await ensureActiveServiceExists(serviceId);

  const existingProviderService = await getProviderServiceByProviderAndServiceIdOrNull(
    providerProfile.id,
    serviceId,
  );

  if (!existingProviderService) {
    throw AppError.notFound('Provider service');
  }

  const { error } = await supabaseAdminClient
    .from('provider_services')
    .delete()
    .eq('provider_id', providerProfile.id)
    .eq('service_id', serviceId);

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to delete provider service.',
      500,
      error,
    );
  }
}

export async function listAvailableRequestsMe(
  userId: string,
  filters: ListAvailableRequestsQuery,
): Promise<AvailableRequestRow[]> {
  const providerProfile = await getProviderProfileByUserIdOrThrow(userId);
  assertProviderIsActive(providerProfile);

  const { data: providerServices, error: providerServicesError } = await supabaseAdminClient
    .from('provider_services')
    .select('service_id')
    .eq('provider_id', providerProfile.id)
    .eq('active', true);

  if (providerServicesError) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load provider services.',
      500,
      providerServicesError,
    );
  }

  const activeServiceIds = (providerServices ?? [])
    .map((row) => (typeof row.service_id === 'string' ? row.service_id : null))
    .filter((value): value is string => value !== null);

  if (activeServiceIds.length === 0) {
    return [];
  }

  if (filters.serviceId && !activeServiceIds.includes(filters.serviceId)) {
    return [];
  }

  let query = supabaseAdminClient
    .from('service_requests')
    .select(
      'id, title, description, service_id, location_state, location_city, location_neighborhood, desired_start_at, desired_end_at, budget_cents, created_at, services(id, name, description)',
    )
    .eq('status', 'open')
    .in('service_id', activeServiceIds)
    .order('created_at', { ascending: false });

  if (filters.serviceId) {
    query = query.eq('service_id', filters.serviceId);
  }

  if (filters.city) {
    query = query.eq('location_city', filters.city);
  }

  if (filters.neighborhood) {
    query = query.eq('location_neighborhood', filters.neighborhood);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load available service requests.',
      500,
      error,
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const serviceRecord =
      typeof row.services === 'object' && row.services !== null
        ? (row.services as Record<string, unknown>)
        : null;

    return {
      id: typeof row.id === 'string' ? row.id : '',
      title: typeof row.title === 'string' ? row.title : '',
      description: typeof row.description === 'string' ? row.description : null,
      service: {
        id: typeof serviceRecord?.id === 'string' ? serviceRecord.id : '',
        name: typeof serviceRecord?.name === 'string' ? serviceRecord.name : null,
        description:
          typeof serviceRecord?.description === 'string'
            ? serviceRecord.description
            : null,
      },
      locationState:
        typeof row.location_state === 'string' ? row.location_state : null,
      locationCity: typeof row.location_city === 'string' ? row.location_city : null,
      locationNeighborhood:
        typeof row.location_neighborhood === 'string'
          ? row.location_neighborhood
          : null,
      desiredStartAt:
        typeof row.desired_start_at === 'string' ? row.desired_start_at : null,
      desiredEndAt: typeof row.desired_end_at === 'string' ? row.desired_end_at : null,
      budgetCents: typeof row.budget_cents === 'number' ? row.budget_cents : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    };
  });
}
