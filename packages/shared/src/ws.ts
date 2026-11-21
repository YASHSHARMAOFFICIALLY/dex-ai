import { z } from "zod";
import { defineEnvelope } from "./envelope";
import { rehearsalActionSchema } from "./rehearsal";

const id = z.string().min(1);

export const sessionUpdatedSchema = defineEnvelope(
  "session.updated",
  z.object({ session_id: id, status: z.string() }),
);

export const traceStartedSchema = defineEnvelope(
  "trace.started",
  z.object({ trace_id: id, task_id: id, session_id: id, step: z.string() }),
);

export const traceDeltaSchema = defineEnvelope(
  "trace.delta",
  z.object({ trace_id: id, text: z.string() }),
);

export const traceCompletedSchema = defineEnvelope(
  "trace.completed",
  z.object({ trace_id: id, output: z.unknown(), confidence: z.number().min(0).max(1).nullable() }),
);

export const taskFailedSchema = defineEnvelope(
  "task.failed",
  z.object({ task_id: id, message: z.string() }),
);

export const profileUpdatedSchema = defineEnvelope(
  "profile.updated",
  z.object({ entry_ids: z.array(id) }),
);

export const revisionCreatedSchema = defineEnvelope(
  "revision.created",
  z.object({ revision_id: id, entity_type: z.string(), entity_id: id }),
);

export const rehearsalProposedSchema = defineEnvelope(
  "rehearsal.proposed",
  z.object({ rehearsal_id: id, action: rehearsalActionSchema }),
);

export const rehearsalPausedSchema = defineEnvelope(
  "rehearsal.paused",
  z.object({ rehearsal_id: id, reason: z.string() }),
);

export const rehearsalExecutedSchema = defineEnvelope(
  "rehearsal.executed",
  z.object({ rehearsal_id: id, action_id: id }),
);

export const rehearsalBlockedSchema = defineEnvelope(
  "rehearsal.blocked",
  z.object({ rehearsal_id: id, action_id: id, reason: z.string() }),
);

export const wsEventSchema = z.discriminatedUnion("type", [
  sessionUpdatedSchema,
  traceStartedSchema,
  traceDeltaSchema,
  traceCompletedSchema,
  taskFailedSchema,
  profileUpdatedSchema,
  revisionCreatedSchema,
  rehearsalProposedSchema,
  rehearsalPausedSchema,
  rehearsalExecutedSchema,
  rehearsalBlockedSchema,
]);

export type WsEvent = z.infer<typeof wsEventSchema>;
export type WsEventType = WsEvent["type"];
