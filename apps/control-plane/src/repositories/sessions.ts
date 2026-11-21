import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { sessions } from "../db/schema";

export type SessionRow = typeof sessions.$inferSelect;

export type SessionInfo = {
  id: string;
  browser_kind: "chrome" | "firefox";
  source: string;
};

export async function upsertSession(db: Database, info: SessionInfo, now: string): Promise<void> {
  await db
    .insert(sessions)
    .values({
      id: info.id,
      browserKind: info.browser_kind,
      source: info.source,
      status: "active",
      startedAt: now,
    })
    .onConflictDoNothing();
}

export async function listSessions(db: Database): Promise<SessionRow[]> {
  return db.select().from(sessions).orderBy(desc(sessions.startedAt));
}

export async function getSession(db: Database, id: string): Promise<SessionRow | undefined> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  return rows[0];
}
