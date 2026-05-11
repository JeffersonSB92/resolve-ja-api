import {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { supabaseAdminClient, supabaseAnonClient } from '../config/supabase.js';
import { AppError } from '../shared/errors/AppError.js';

type Role = string;

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type ProviderProfile = {
  id: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type UserRoleRow = {
  role?: unknown;
};

type AuthContext = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  roles: Role[];
  isAdmin: boolean;
  providerProfile: ProviderProfile | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }

  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return value as Profile;
}

function parseProviderProfile(value: unknown): ProviderProfile | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.user_id !== 'string'
  ) {
    return null;
  }

  return value as ProviderProfile;
}

function parseRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!isRecord(row) || typeof row.role !== 'string' || row.role.length === 0) {
      return [];
    }

    return [row.role];
  });
}

function extractBearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;

  if (!authorization) {
    throw AppError.unauthorized('Authorization header is required.');
  }

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthorized(
      'Invalid authorization header format. Use Bearer <token>.',
    );
  }

  return token;
}

async function buildAuthContext(token: string): Promise<AuthContext> {
  const { data: authData, error: authError } =
    await supabaseAnonClient.auth.getUser(token);

  if (authError || !authData.user) {
    throw AppError.unauthorized('Invalid or expired access token.');
  }

  const userId = authData.user.id;

  const [profileResult, rolesResult, providerResult] = await Promise.all([
    supabaseAdminClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabaseAdminClient
      .from('app_user_roles')
      .select('role')
      .eq('user_id', userId),
    supabaseAdminClient
      .from('provider_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (profileResult.error && !isNoRowsError(profileResult.error)) {
    throw AppError.internal('Failed to load user profile.');
  }

  if (rolesResult.error) {
    throw AppError.internal('Failed to load user roles.');
  }

  if (providerResult.error && !isNoRowsError(providerResult.error)) {
    throw AppError.internal('Failed to load provider profile.');
  }

  const profile = parseProfile(profileResult.data);
  const roles = parseRoles(rolesResult.data as UserRoleRow[]);
  const providerProfile = parseProviderProfile(providerResult.data);
  const isAdmin = roles.some((role) => role.toLowerCase() === 'admin');

  return {
    userId,
    email: authData.user.email ?? null,
    profile,
    roles,
    isAdmin,
    providerProfile,
  };
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('auth', null);

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const token = extractBearerToken(request);
      request.auth = await buildAuthContext(token);
    },
  );

  fastify.decorate(
    'requireAdmin',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await fastify.authenticate(request, reply);

      if (!request.auth?.isAdmin) {
        throw AppError.forbidden('Admin access is required.');
      }
    },
  );
};

export default fp(authPlugin, {
  name: 'auth-plugin',
});
