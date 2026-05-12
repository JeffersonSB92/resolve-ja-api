import { supabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../shared/errors/AppError.js';

export type Category = {
  id: string;
  name: string;
  slug: string | null;
  active: boolean;
};

export type Service = {
  id: string;
  category_id: string | null;
  name: string | null;
  description: string | null;
  base_price: number | null;
  active: boolean;
  [key: string]: unknown;
};

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function parseService(row: Record<string, unknown>): Service {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    category_id:
      typeof row.category_id === 'string'
        ? row.category_id
        : typeof row.categoryId === 'string'
          ? row.categoryId
          : null,
    name: typeof row.name === 'string' ? row.name : null,
    description: typeof row.description === 'string' ? row.description : null,
    base_price: typeof row.base_price === 'number' ? row.base_price : null,
    active: row.active === true,
    ...row,
  };
}

export async function listActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabaseAdminClient
    .from('service_categories')
    .select('id, name, slug, active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw AppError.internal('Failed to load categories.');
  }

  return (data ?? []) as Category[];
}

export async function listActiveServices(
  categoryId?: string,
): Promise<Service[]> {
  let query = supabaseAdminClient
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  if (error) {
    // Some schemas may use `categoryId` instead of `category_id`.
    if (categoryId && error.message.includes('category_id')) {
      const fallback = await supabaseAdminClient
        .from('services')
        .select('*')
        .eq('active', true)
        .eq('categoryId', categoryId)
        .order('name', { ascending: true });

      if (fallback.error) {
        throw new AppError(
          'INTERNAL_SERVER_ERROR',
          'Failed to load services.',
          500,
          fallback.error,
        );
      }

      const fallbackRows = (fallback.data ?? []) as Record<string, unknown>[];
      return fallbackRows.map(parseService);
    }

    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load services.',
      500,
      error,
    );
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map(parseService);
}

export async function getActiveServiceById(id: string): Promise<Service> {
  const { data, error } = await supabaseAdminClient
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new AppError(
      'INTERNAL_SERVER_ERROR',
      'Failed to load service.',
      500,
      error,
    );
  }

  if (!data) {
    throw AppError.notFound('Service');
  }

  return parseService(data as Record<string, unknown>);
}
