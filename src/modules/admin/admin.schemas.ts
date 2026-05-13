import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

export const adminProviderParamsSchema = z.object({
  id: z.string().uuid(),
});

export const approveProviderBodySchema = z
  .object({
    note: optionalTrimmedString,
  })
  .strict();

export const rejectProviderBodySchema = z
  .object({
    reason: optionalTrimmedString,
  })
  .strict();

export const suspendProviderBodySchema = z
  .object({
    reason: optionalTrimmedString,
  })
  .strict();

export const adminRequestsQuerySchema = z
  .object({
    status: optionalTrimmedString,
  })
  .strict();

export const adminReportsQuerySchema = z
  .object({
    status: optionalTrimmedString,
  })
  .strict();

export type AdminProviderParams = z.infer<typeof adminProviderParamsSchema>;
export type ApproveProviderBody = z.infer<typeof approveProviderBodySchema>;
export type RejectProviderBody = z.infer<typeof rejectProviderBodySchema>;
export type SuspendProviderBody = z.infer<typeof suspendProviderBodySchema>;
export type AdminRequestsQuery = z.infer<typeof adminRequestsQuerySchema>;
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;
