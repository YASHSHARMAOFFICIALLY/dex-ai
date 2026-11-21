import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { traces } from "../db/schema";

export type TraceRow = typeof traces.$inferSelect;

export async function insertTrace(db: Database, row: typeof traces.$inferInsert): Promise<void> {
  await db.insert(traces).values(row);
}

export async function listTracesBySession(db: Database, sessionId: string): Promise<TraceRow[]> {
  return db.select().from(traces).where(eq(traces.sessionId, sessionId));
}
