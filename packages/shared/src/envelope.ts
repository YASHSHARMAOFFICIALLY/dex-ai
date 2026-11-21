import { z } from "zod";

export const envelopeIdSchema = z.string().min(1);
export const envelopeTimestampSchema = z.iso.datetime({ offset: true });

export function defineEnvelope<Type extends string, Payload extends z.ZodType>(
  type: Type,
  payload: Payload,
) {
  return z.object({
    type: z.literal(type),
    id: envelopeIdSchema,
    ts: envelopeTimestampSchema,
    payload,
  });
}

export const genericEnvelopeSchema = z.object({
  type: z.string().min(1),
  id: envelopeIdSchema,
  ts: envelopeTimestampSchema,
  payload: z.unknown(),
});

export type GenericEnvelope = z.infer<typeof genericEnvelopeSchema>;
