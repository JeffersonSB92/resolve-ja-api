import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastify, { FastifyError, FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { env } from './config/env.js';
import { supabaseAnonClient } from './config/supabase.js';
import addressRoutes from './modules/addresses/address.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import messageRoutes from './modules/messages/message.routes.js';
import providerRoutes from './modules/providers/provider.routes.js';
import quoteRoutes from './modules/quotes/quote.routes.js';
import requestRoutes from './modules/requests/request.routes.js';
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

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'ResolveJa API',
        description: 'API documentation for ResolveJa backend.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformSpecificationClone: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(authPlugin);
  await app.register(catalogRoutes);
  await app.register(addressRoutes);
  await app.register(adminRoutes);
  await app.register(providerRoutes);
  await app.register(requestRoutes);
  await app.register(quoteRoutes);
  await app.register(messageRoutes);

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
