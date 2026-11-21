import { asc, eq } from "drizzle-orm";
import type { ObservedEvent } from "@dex-ai/shared";
import type { Database } from "../db/client";
import { events } from "../db/schema";

export type EventRow = typeof events.$inferSelect;

function toRow(sessionId: string, event: ObservedEvent): typeof events.$inferInsert {
  return {
    id: event.id,
    sessionId,
    type: event.type,
    capturedAt: event.ts,
    sourceUrl: event.payload.source_url,
    payload: event.payload,
    dedupeKey: event.id,
  };
}

// Returns how many events were new. Rows whose id was already stored are skipped.
export async function insertEvents(
  db: Database,
  sessionId: string,
  batch: ObservedEvent[],
): Promise<number> {
  const rows = batch.map((event) => toRow(sessionId, event));
  const inserted = await db
    .insert(events)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: events.id });
  return inserted.length;
}

export async function listEventsBySession(db: Database, sessionId: string): Promise<EventRow[]> {
  return db.select().from(events).where(eq(events.sessionId, sessionId)).orderBy(asc(events.capturedAt));
}
