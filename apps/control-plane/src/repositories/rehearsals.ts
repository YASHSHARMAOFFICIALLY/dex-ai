import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { rehearsalActions, rehearsals } from "../db/schema";

export type RehearsalActionRow = typeof rehearsalActions.$inferSelect;

export async function listActionsBySession(
  db: Database,
  sessionId: string,
): Promise<RehearsalActionRow[]> {
  const rows = await db
    .select({ action: rehearsalActions })
    .from(rehearsalActions)
    .innerJoin(rehearsals, eq(rehearsals.id, rehearsalActions.rehearsalId))
    .where(eq(rehearsals.sessionId, sessionId));
  return rows.map((row) => row.action);
}
