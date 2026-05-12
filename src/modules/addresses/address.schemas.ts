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

export const addressParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const createAddressBodySchema = z.object({
  label: optionalNullableTrimmedString,
  postalCode: optionalTrimmedString,
  state: z.string().trim().min(1),
  city: z.string().trim().min(1),
  neighborhood: optionalNullableTrimmedString,
  street: z.string().trim().min(1),
  number: optionalNullableTrimmedString,
  complement: optionalNullableTrimmedString,
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressBodySchema = z
  .object({
    label: optionalNullableTrimmedString,
    postalCode: optionalTrimmedString,
    state: optionalTrimmedString,
    city: optionalTrimmedString,
    neighborhood: optionalNullableTrimmedString,
    street: optionalTrimmedString,
    number: optionalNullableTrimmedString,
    complement: optionalNullableTrimmedString,
    lat: z.number().finite().nullable().optional(),
    lng: z.number().finite().nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>;
export type AddressParams = z.infer<typeof addressParamsSchema>;
