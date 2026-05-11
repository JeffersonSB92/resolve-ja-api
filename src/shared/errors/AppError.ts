export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  public static badRequest(
    code: string,
    message: string,
    details?: unknown,
  ): AppError {
    return new AppError(code, message, 400, details);
  }

  public static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  public static forbidden(message = 'Forbidden'): AppError {
    return new AppError('FORBIDDEN', message, 403);
  }

  public static notFound(resource = 'Resource'): AppError {
    return new AppError('NOT_FOUND', `${resource} not found`, 404);
  }

  public static conflict(
    code: string,
    message: string,
    details?: unknown,
  ): AppError {
    return new AppError(code, message, 409, details);
  }

  public static internal(message = 'Internal server error'): AppError {
    return new AppError('INTERNAL_SERVER_ERROR', message, 500);
  }
}
