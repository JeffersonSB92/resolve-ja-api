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

const quoteStatusSchema = z.enum([
  'sent',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'canceled',
]);

export const requestQuoteParamsSchema = z.object({
  id: z.string().uuid(),
});

export const quoteIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createQuoteBodySchema = z
  .object({
    amountCents: z.number().int().positive(),
    message: optionalTrimmedString,
    estimatedDurationMinutes: z.number().int().positive().optional(),
    validUntil: z.string().datetime().optional(),
  })
  .strict();

export const listProviderQuotesQuerySchema = z
  .object({
    status: quoteStatusSchema.optional(),
  })
  .strict();

export type RequestQuoteParams = z.infer<typeof requestQuoteParamsSchema>;
export type QuoteIdParams = z.infer<typeof quoteIdParamsSchema>;
export type CreateQuoteBody = z.infer<typeof createQuoteBodySchema>;
export type ListProviderQuotesQuery = z.infer<typeof listProviderQuotesQuerySchema>;
