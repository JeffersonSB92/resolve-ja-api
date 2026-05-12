import { z } from 'zod';
import { AppError } from '../errors/AppError.js';

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'field';
  }

  return path.map((segment) => String(segment)).join('.');
}

function isMissingRequiredField(issue: z.core.$ZodIssue): boolean {
  if (issue.code === 'invalid_type') {
    const typedIssue = issue as z.core.$ZodIssueInvalidType;
    return typedIssue.input === undefined;
  }

  if (issue.code === 'too_small') {
    const typedIssue = issue as z.core.$ZodIssueTooSmall;
    return typedIssue.minimum === 1 && typedIssue.origin === 'string';
  }

  return false;
}

export function validateOrThrow<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): T {
  const result = schema.safeParse(payload);

  if (result.success) {
    return result.data;
  }

  const firstIssue = result.error.issues[0];

  if (!firstIssue) {
    throw AppError.badRequest('VALIDATION_ERROR', 'Validation failed.');
  }

  const field = formatPath(firstIssue.path);
  const message = isMissingRequiredField(firstIssue)
    ? `${field} is required.`
    : `${field}: ${firstIssue.message}`;

  throw AppError.badRequest('VALIDATION_ERROR', message, {
    field,
    issue: firstIssue,
  });
}
