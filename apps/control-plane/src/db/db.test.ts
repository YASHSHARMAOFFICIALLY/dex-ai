import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, withTransaction } from "./client";
import { runMigrations } from "./migrate";
import { events, sessions } from "./schema";

let dir: string;
let path: string;
const opened: Array<() => void> = [];

async function open() {
  const handle = openDatabase(path);
  opened.push(handle.close);
  await runMigrations(handle.db, handle.sqlite);
  return handle;
}

function sessionRow(id: string) {
  return {
    id,
    browserKind: "chrome" as const,
    source: "extension",
    postingUrl: null,
    status: "active",
    startedAt: "2026-11-22T00:00:00.000Z",
  };
}

function eventRow(id: string, dedupeKey: string) {
  return {
    id,
    sessionId: "s1",
    type: "field_filled" as const,
    capturedAt: "2026-11-22T00:00:01.000Z",
    sourceUrl: "http://127.0.0.1/apply",
    payload: { field: "email", nested: [1, 2] },
    dedupeKey,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dex-db-"));
  path = join(dir, "nested", "dex-ai.sqlite");
});

afterEach(() => {
  for (const close of opened.splice(0)) {
    try {
      close();
    } catch {
      // already closed
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("database", () => {
  it("migrates a fresh file with WAL and foreign keys", async () => {
    const { sqlite } = await open();
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining(["sessions", "events", "rehearsal_actions"]));
    expect(sqlite.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
    expect(sqlite.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
  });

  it("repeat migration is a no-op", async () => {
    const { db, sqlite } = await open();
    await runMigrations(db, sqlite);
    const rows = sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get();
    expect(rows).toMatchObject({ n: 1 });
  });

  it("inserts and reads a session and event with JSON payload", async () => {
    const { db } = await open();
    await db.insert(sessions).values(sessionRow("s1"));
    await db.insert(events).values(eventRow("e1", "k1"));
    const [row] = await db.select().from(events).where(eq(events.id, "e1"));
    expect(row?.payload).toEqual({ field: "email", nested: [1, 2] });
    expect(row?.sessionId).toBe("s1");
  });

  it("rejects duplicate dedupe keys and orphan events", async () => {
    const { db } = await open();
    await db.insert(sessions).values(sessionRow("s1"));
    await db.insert(events).values(eventRow("e1", "k1"));
    await expect(db.insert(events).values(eventRow("e2", "k1"))).rejects.toThrow();
    const orphan = { ...eventRow("e3", "k3"), sessionId: "missing" };
    await expect(db.insert(events).values(orphan)).rejects.toThrow();
  });

  it("rolls back a failed transaction and keeps a committed one", async () => {
    const { db, sqlite } = await open();
    await expect(
      withTransaction(sqlite, async () => {
        await db.insert(sessions).values(sessionRow("s1"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.select().from(sessions)).toHaveLength(0);
    await withTransaction(sqlite, async () => {
      await db.insert(sessions).values(sessionRow("s2"));
    });
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("runs concurrent transactions one at a time", async () => {
    const { db, sqlite } = await open();
    const slowFailing = withTransaction(sqlite, async () => {
      await db.insert(sessions).values(sessionRow("s1"));
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("boom");
    });
    const second = withTransaction(sqlite, async () => {
      await db.insert(sessions).values(sessionRow("s2"));
    });
    await expect(slowFailing).rejects.toThrow("boom");
    await second;
    const rows = await db.select().from(sessions);
    expect(rows.map((row) => row.id)).toEqual(["s2"]);
  });

  it("keeps data after close and reopen", async () => {
    const first = await open();
    await first.db.insert(sessions).values(sessionRow("s1"));
    first.close();
    const second = await open();
    expect(await second.db.select().from(sessions)).toHaveLength(1);
  });
});
