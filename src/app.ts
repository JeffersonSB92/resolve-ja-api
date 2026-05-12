import cors from '@fastify/cors';
import fastify, { FastifyError, FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { env } from './config/env.js';
import { supabaseAnonClient } from './config/supabase.js';
import addressRoutes from './modules/addresses/address.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import authPlugin from './plugins/auth.js';
import { AppError } from './shared/errors/AppError.js';
import { errorResponse, successResponse } from './shared/utils/response.js';
import { validateOrThrow } from './shared/utils/validation.js';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function isFastifyValidationError(
  error: unknown,
): error is FastifyError & { validation: unknown } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (
    'validation' in error &&
    (error as { validation?: unknown }).validation !== undefined
  );
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(authPlugin);
  await app.register(catalogRoutes);
  await app.register(addressRoutes);

  app.get('/health', async (_request, reply) => {
    return successResponse(reply, { status: 'ok' });
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = validateOrThrow(loginBodySchema, request.body);

    const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw AppError.unauthorized('Invalid email or password.');
    }

    return successResponse(reply, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      tokenType: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
    });
  });

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      if (!request.auth) {
        throw AppError.unauthorized('User is not authenticated.');
      }

      return successResponse(reply, {
        userId: request.auth.userId,
        email: request.auth.email,
        profile: request.auth.profile,
        roles: request.auth.roles,
        isAdmin: request.auth.isAdmin,
        providerProfile: request.auth.providerProfile,
      });
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return errorResponse(reply, {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      });
    }

    if (error instanceof ZodError) {
      return errorResponse(reply, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        statusCode: 400,
        details: error.flatten(),
      });
    }

    if (isFastifyValidationError(error)) {
      return errorResponse(reply, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        statusCode: 400,
        details: error.validation,
      });
    }

    const internalError =
      error instanceof Error ? error : new Error('Unexpected unknown error.');

    request.log.error(internalError);

    return errorResponse(reply, {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'Internal server error.'
          : internalError.message || 'Internal server error.',
      statusCode: 500,
      details:
        env.NODE_ENV === 'production'
          ? undefined
          : {
              stack: internalError.stack,
            },
    });
  });

  return app;
}
