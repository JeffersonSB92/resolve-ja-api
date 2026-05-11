import { FastifyReply } from 'fastify';

type SuccessBody<T> = {
  success: true;
  message?: string;
  data: T;
};

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ErrorResponseInput = {
  code: string;
  message: string;
  statusCode?: number;
  details?: unknown;
};

export function successResponse<T>(
  reply: FastifyReply,
  data: T,
  message?: string,
): FastifyReply {
  const body: SuccessBody<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
  };

  return reply.status(200).send(body);
}

export function createdResponse<T>(
  reply: FastifyReply,
  data: T,
  message?: string,
): FastifyReply {
  const body: SuccessBody<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
  };

  return reply.status(201).send(body);
}

export function noContentResponse(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

export function errorResponse(
  reply: FastifyReply,
  { code, message, statusCode = 400, details }: ErrorResponseInput,
): FastifyReply {
  const body: ErrorBody = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return reply.status(statusCode).send(body);
}
