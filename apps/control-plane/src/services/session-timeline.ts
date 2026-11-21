import type { Database } from "../db/client";
import { listEventsBySession, type EventRow } from "../repositories/events";
import { listActionsBySession, type RehearsalActionRow } from "../repositories/rehearsals";
import { listRevisionsBySession, type RevisionRow } from "../repositories/revisions";
import { listTracesBySession, type TraceRow } from "../repositories/traces";

export type TimelineEntry =
  | { kind: "event"; at: string; data: EventRow }
  | { kind: "trace"; at: string; data: TraceRow }
  | { kind: "revision"; at: string; data: RevisionRow }
  | { kind: "rehearsal_action"; at: string; data: RehearsalActionRow };

function byTime(a: TimelineEntry, b: TimelineEntry): number {
  return Date.parse(a.at) - Date.parse(b.at);
}

export async function buildTimeline(db: Database, sessionId: string): Promise<TimelineEntry[]> {
  const [events, traces, revisions, actions] = await Promise.all([
    listEventsBySession(db, sessionId),
    listTracesBySession(db, sessionId),
    listRevisionsBySession(db, sessionId),
    listActionsBySession(db, sessionId),
  ]);
  const entries: TimelineEntry[] = [
    ...events.map((data): TimelineEntry => ({ kind: "event", at: data.capturedAt, data })),
    ...traces.map((data): TimelineEntry => ({ kind: "trace", at: data.createdAt, data })),
    ...revisions.map((data): TimelineEntry => ({ kind: "revision", at: data.createdAt, data })),
    ...actions.map((data): TimelineEntry => ({ kind: "rehearsal_action", at: data.createdAt, data })),
  ];
  return entries.sort(byTime);
}
