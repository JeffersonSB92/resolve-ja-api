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

const optionalNullableTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).nullable().optional(),
);

const requestStatusSchema = z.enum([
  'open',
  'scheduled',
  'in_progress',
  'provider_arrived',
  'awaiting_pin',
  'completed',
  'canceled',
  'disputed',
]);

export const requestIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listMyRequestsQuerySchema = z
  .object({
    status: requestStatusSchema.optional(),
  })
  .strict();

export const createRequestBodySchema = z
  .object({
    serviceId: z.string().uuid(),
    addressId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: optionalNullableTrimmedString,
    desiredStartAt: z.string().datetime().optional(),
    desiredEndAt: z.string().datetime().optional(),
    budgetCents: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (payload) => {
      if (!payload.desiredStartAt || !payload.desiredEndAt) {
        return true;
      }

      return new Date(payload.desiredEndAt) >= new Date(payload.desiredStartAt);
    },
    {
      message: 'desiredEndAt cannot be before desiredStartAt.',
      path: ['desiredEndAt'],
    },
  );

export const updateRequestBodySchema = z
  .object({
    title: optionalTrimmedString,
    description: optionalNullableTrimmedString,
    desiredStartAt: z.string().datetime().optional(),
    desiredEndAt: z.string().datetime().optional(),
    budgetCents: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  })
  .refine(
    (payload) => {
      if (!payload.desiredStartAt || !payload.desiredEndAt) {
        return true;
      }

      return new Date(payload.desiredEndAt) >= new Date(payload.desiredStartAt);
    },
    {
      message: 'desiredEndAt cannot be before desiredStartAt.',
      path: ['desiredEndAt'],
    },
  );

export const cancelRequestBodySchema = z
  .object({
    reason: optionalTrimmedString,
  })
  .strict();

export const requestCheckInBodySchema = z
  .object({
    selfiePath: z.string().trim().min(1),
    lat: z.number().finite().optional(),
    lng: z.number().finite().optional(),
  })
  .strict();

export const generateStartPinBodySchema = z.object({}).strict();

export const startServiceBodySchema = z
  .object({
    pin: z.string().trim().min(1),
  })
  .strict();

export type RequestIdParams = z.infer<typeof requestIdParamsSchema>;
export type ListMyRequestsQuery = z.infer<typeof listMyRequestsQuerySchema>;
export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;
export type UpdateRequestBody = z.infer<typeof updateRequestBodySchema>;
export type CancelRequestBody = z.infer<typeof cancelRequestBodySchema>;
export type RequestCheckInBody = z.infer<typeof requestCheckInBodySchema>;
export type StartServiceBody = z.infer<typeof startServiceBodySchema>;
