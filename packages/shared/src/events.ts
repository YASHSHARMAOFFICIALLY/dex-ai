import { z } from "zod";
import { defineEnvelope } from "./envelope";

export const eventTypes = [
  "search_filter",
  "posting_opened",
  "field_filled",
  "reason_stated",
] as const;

const sourceUrlSchema = z.url();
const filterValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const searchFilterPayloadSchema = z.object({
  source_url: sourceUrlSchema,
  query: z.string().optional(),
  filters: z.record(z.string(), filterValueSchema),
});

export const postingOpenedPayloadSchema = z.object({
  source_url: sourceUrlSchema,
  title: z.string().min(1),
  company: z.string().min(1),
});

export const fieldFilledPayloadSchema = z.object({
  source_url: sourceUrlSchema,
  field_name: z.string().min(1),
  field_label: z.string().optional(),
  value: z.string(),
});

export const reasonStatedPayloadSchema = z.object({
  source_url: sourceUrlSchema,
  text: z.string().min(1),
  about_field: z.string().optional(),
});

export const searchFilterEventSchema = defineEnvelope("search_filter", searchFilterPayloadSchema);
export const postingOpenedEventSchema = defineEnvelope("posting_opened", postingOpenedPayloadSchema);
export const fieldFilledEventSchema = defineEnvelope("field_filled", fieldFilledPayloadSchema);
export const reasonStatedEventSchema = defineEnvelope("reason_stated", reasonStatedPayloadSchema);

export const observedEventSchema = z.discriminatedUnion("type", [
  searchFilterEventSchema,
  postingOpenedEventSchema,
  fieldFilledEventSchema,
  reasonStatedEventSchema,
]);

export type ObservedEvent = z.infer<typeof observedEventSchema>;
export type ObservedEventType = (typeof eventTypes)[number];
