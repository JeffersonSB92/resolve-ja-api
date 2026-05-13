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

export const requestMessageParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createMessageBodySchema = z
  .object({
    body: optionalTrimmedString,
    attachmentPath: optionalNullableTrimmedString,
  })
  .strict()
  .refine((payload) => Boolean(payload.body) || Boolean(payload.attachmentPath), {
    message: 'body or attachmentPath must be provided.',
  });

export type RequestMessageParams = z.infer<typeof requestMessageParamsSchema>;
export type CreateMessageBody = z.infer<typeof createMessageBodySchema>;
