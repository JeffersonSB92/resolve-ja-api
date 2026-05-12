import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';
import { CreateAddressBody, UpdateAddressBody } from './address.schemas.js';

type AddressRow = {
  id: string;
  user_id: string;
  label: string | null;
  postal_code: string | null;
  state: string;
  city: string;
  neighborhood: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  [key: string]: unknown;
};

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function toAddressPayload(payload: CreateAddressBody | UpdateAddressBody): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {};

  if ('label' in payload) dbPayload.label = payload.label ?? null;
  if ('postalCode' in payload) dbPayload.postal_code = payload.postalCode;
  if ('state' in payload) dbPayload.state = payload.state;
  if ('city' in payload) dbPayload.city = payload.city;
  if ('neighborhood' in payload) dbPayload.neighborhood = payload.neighborhood ?? null;
  if ('street' in payload) dbPayload.street = payload.street;
  if ('number' in payload) dbPayload.number = payload.number ?? null;
  if ('complement' in payload) dbPayload.complement = payload.complement ?? null;
  if ('lat' in payload) dbPayload.lat = payload.lat ?? null;
  if ('lng' in payload) dbPayload.lng = payload.lng ?? null;
  if ('isDefault' in payload) dbPayload.is_default = payload.isDefault ?? false;

  return dbPayload;
}

async function unsetDefaultAddresses(userId: string, exceptId?: string): Promise<void> {
  let query = supabaseAdminClient
    .from('user_addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);

  if (exceptId) {
    query = query.neq('id', exceptId);
  }

  const { error } = await query;

  if (error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to update default addresses.',
      500,
      error,
    );
  }
}

async function findUserAddressById(userId: string, id: string): Promise<AddressRow> {
  const { data, error } = await supabaseAdminClient
    .from('user_addresses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load address.',
      500,
      error,
    );
  }

  if (!data) {
    throw AppError.notFound('Address');
  }

  return data as AddressRow;
}

async function hasActiveServiceRequests(addressId: string): Promise<boolean> {
  const inactiveStatuses = ['completed', 'canceled', 'disputed'];

  const byAddressId = await supabaseAdminClient
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('address_id', addressId)
    .neq('status', inactiveStatuses[0]!)
    .neq('status', inactiveStatuses[1]!)
    .neq('status', inactiveStatuses[2]!);

  if (!byAddressId.error) {
    return (byAddressId.count ?? 0) > 0;
  }

  if (!byAddressId.error.message.includes('address_id')) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to verify linked service requests.',
      500,
      byAddressId.error,
    );
  }

  const byUserAddressId = await supabaseAdminClient
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_address_id', addressId)
    .neq('status', inactiveStatuses[0]!)
    .neq('status', inactiveStatuses[1]!)
    .neq('status', inactiveStatuses[2]!);

  if (byUserAddressId.error) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to verify linked service requests.',
      500,
      byUserAddressId.error,
    );
  }

  return (byUserAddressId.count ?? 0) > 0;
}

export async function createAddress(
  userId: string,
  payload: CreateAddressBody,
): Promise<AddressRow> {
  if (payload.isDefault) {
    await unsetDefaultAddresses(userId);
  }

  const insertPayload = {
    ...toAddressPayload(payload),
    user_id: userId,
  };

  const { data, error } = await supabaseAdminClient
    .from('user_addresses')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to create address.', 500, error);
  }

  return data as AddressRow;
}

export async function listUserAddresses(userId: string): Promise<AddressRow[]> {
  const { data, error } = await supabaseAdminClient
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to load addresses.', 500, error);
  }

  return (data ?? []) as AddressRow[];
}

export async function getUserAddressById(
  userId: string,
  id: string,
): Promise<AddressRow> {
  return findUserAddressById(userId, id);
}

export async function updateUserAddress(
  userId: string,
  id: string,
  payload: UpdateAddressBody,
): Promise<AddressRow> {
  await findUserAddressById(userId, id);

  if (payload.isDefault) {
    await unsetDefaultAddresses(userId, id);
  }

  const updates = toAddressPayload(payload);

  const { data, error } = await supabaseAdminClient
    .from('user_addresses')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to update address.', 500, error);
  }

  return data as AddressRow;
}

export async function deleteUserAddress(userId: string, id: string): Promise<void> {
  await findUserAddressById(userId, id);

  const hasActiveRequests = await hasActiveServiceRequests(id);

  if (hasActiveRequests) {
    throw AppError.conflict(
      'ADDRESS_LINKED_TO_ACTIVE_REQUEST',
      'Address is linked to an active service request.',
    );
  }

  const { error } = await supabaseAdminClient
    .from('user_addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to delete address.', 500, error);
  }
}
