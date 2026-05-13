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

const optionalPositiveNumber = z
  .number()
  .finite()
  .positive('Must be greater than zero.')
  .optional();

export const createProviderProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1),
    bio: optionalNullableTrimmedString,
    baseState: z.string().trim().min(1),
    baseCity: z.string().trim().min(1),
    baseNeighborhood: optionalNullableTrimmedString,
    serviceRadiusKm: optionalPositiveNumber,
  })
  .strict();

export const updateProviderProfileBodySchema = z
  .object({
    displayName: optionalTrimmedString,
    bio: optionalNullableTrimmedString,
    baseState: optionalTrimmedString,
    baseCity: optionalTrimmedString,
    baseNeighborhood: optionalNullableTrimmedString,
    serviceRadiusKm: optionalPositiveNumber,
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

export const providerServiceParamsSchema = z.object({
  serviceId: z.string().uuid(),
});

export const createProviderServiceBodySchema = z
  .object({
    serviceId: z.string().uuid(),
    basePriceCents: z.number().int().min(0).nullable().optional(),
    priceNotes: optionalNullableTrimmedString,
  })
  .strict();

export const updateProviderServiceBodySchema = z
  .object({
    basePriceCents: z.number().int().min(0).nullable().optional(),
    priceNotes: optionalNullableTrimmedString,
    active: z.boolean().optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

export const listAvailableRequestsQuerySchema = z
  .object({
    serviceId: z.string().uuid().optional(),
    city: optionalTrimmedString,
    neighborhood: optionalTrimmedString,
  })
  .strict();

export type CreateProviderProfileBody = z.infer<
  typeof createProviderProfileBodySchema
>;
export type UpdateProviderProfileBody = z.infer<
  typeof updateProviderProfileBodySchema
>;
export type ProviderServiceParams = z.infer<typeof providerServiceParamsSchema>;
export type CreateProviderServiceBody = z.infer<
  typeof createProviderServiceBodySchema
>;
export type UpdateProviderServiceBody = z.infer<
  typeof updateProviderServiceBodySchema
>;
export type ListAvailableRequestsQuery = z.infer<
  typeof listAvailableRequestsQuerySchema
>;
