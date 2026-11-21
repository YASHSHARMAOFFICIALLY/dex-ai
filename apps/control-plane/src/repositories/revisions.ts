import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { revisions } from "../db/schema";

export type RevisionRow = typeof revisions.$inferSelect;

export async function insertRevision(
  db: Database,
  row: typeof revisions.$inferInsert,
): Promise<void> {
  await db.insert(revisions).values(row);
}

export async function listRevisionsBySession(
  db: Database,
  sessionId: string,
): Promise<RevisionRow[]> {
  return db.select().from(revisions).where(eq(revisions.sourceSessionId, sessionId));
}
