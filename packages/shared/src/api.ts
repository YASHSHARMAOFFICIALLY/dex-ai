import { z } from "zod";
import { observedEventSchema } from "./events";

export const browserKindSchema = z.enum(["chrome", "firefox"]);

export const sessionInfoSchema = z.object({
  id: z.string().min(1),
  browser_kind: browserKindSchema,
  source: z.string().min(1),
});

export const eventBatchRequestSchema = z.object({
  session: sessionInfoSchema,
  events: z.array(observedEventSchema).min(1).max(500),
});

export const eventBatchResponseSchema = z.object({
  accepted: z.number().int().min(0),
  duplicates: z.number().int().min(0),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  ready: z.boolean(),
});

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});

export const createTeachingDraftRequestSchema = z.object({
  source: z.enum(["voice", "typed"]),
  transcript: z.string().min(1),
  session_id: z.string().min(1).optional(),
});

export const transcribeResponseSchema = z.object({ text: z.string() });

export const startRehearsalRequestSchema = z.object({
  posting_url: z.url(),
  browser_kind: browserKindSchema,
  session_id: z.string().min(1).optional(),
});

export const rehearsalDecisionRequestSchema = z.object({
  action_id: z.string().min(1).optional(),
  decision: z.enum(["approve", "correct", "reject", "pause", "resume"]),
  corrected_value: z.string().optional(),
});

export type EventBatchRequest = z.infer<typeof eventBatchRequestSchema>;
export type EventBatchResponse = z.infer<typeof eventBatchResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type CreateTeachingDraftRequest = z.infer<typeof createTeachingDraftRequestSchema>;
export type StartRehearsalRequest = z.infer<typeof startRehearsalRequestSchema>;
export type RehearsalDecisionRequest = z.infer<typeof rehearsalDecisionRequestSchema>;
