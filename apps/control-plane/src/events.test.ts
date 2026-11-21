import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { parseConfig, type Config } from "./config";
import { openDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { agentTasks, events as eventsTable } from "./db/schema";
import { insertRevision } from "./repositories/revisions";
import { insertTrace } from "./repositories/traces";
import { startServer, type RunningServer } from "./server";
import { createHub } from "./stream/hub";

const TOKEN = "t".repeat(40);

let dir: string;
let config: Config;
let running: RunningServer;
let opened: ReturnType<typeof openDatabase>;
let published: unknown[];

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function boot(): Promise<void> {
  const hub = createHub();
  const publish = hub.publish;
  hub.publish = (envelope) => {
    published.push(envelope);
    publish(envelope);
  };
  const app = createApp({ config, db: opened.db, sqlite: opened.sqlite, hub });
  running = await startServer(app, config, hub);
}

beforeEach(async () => {
  published = [];
  dir = mkdtempSync(join(tmpdir(), "dex-events-"));
  config = parseConfig({
    token: TOKEN,
    host: "127.0.0.1",
    port: await freePort(),
    dataDir: dir,
    allowedExtensionOrigins: [],
    uiOrigin: "http://127.0.0.1:5173",
    confidenceThreshold: 0.7,
    parakeetModelDir: join(dir, "models"),
  });
  opened = openDatabase(join(dir, "dex-ai.sqlite"));
  await runMigrations(opened.db, opened.sqlite);
  await boot();
});

afterEach(async () => {
  await running.close();
  opened.close();
  rmSync(dir, { recursive: true, force: true });
});

function call(path: string, body?: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${config.port}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fieldEvent(id: string, ts: string) {
  return {
    type: "field_filled",
    id,
    ts,
    payload: { source_url: "http://127.0.0.1/apply", field_name: "email", value: "a@b.co" },
  };
}

function batch(kind: "chrome" | "firefox", ...events: unknown[]) {
  return { session: { id: "s1", browser_kind: kind, source: "fixture" }, events };
}

describe("event ingest", () => {
  it("stores a valid batch and publishes session.updated", async () => {
    const res = await call("/api/events/batches", batch("chrome", fieldEvent("e1", "2026-11-22T10:00:00Z")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 1, duplicates: 0 });
    expect(published).toMatchObject([{ type: "session.updated", payload: { session_id: "s1" } }]);
    const rows = await opened.db.select().from(eventsTable);
    expect(rows).toMatchObject([{ id: "e1", dedupeKey: "e1", sessionId: "s1", type: "field_filled" }]);
  });

  it("stores firefox and chrome events the same way", async () => {
    await call("/api/events/batches", batch("firefox", fieldEvent("e1", "2026-11-22T10:00:00Z")));
    const detail = await (await call("/api/sessions/s1")).json();
    expect(detail.session.browserKind).toBe("firefox");
    expect(detail.timeline).toHaveLength(1);
  });

  it("ignores duplicate ids inside and across batches", async () => {
    const dup = fieldEvent("e1", "2026-11-22T10:00:00Z");
    const first = await call("/api/events/batches", batch("chrome", dup, dup));
    expect(await first.json()).toEqual({ accepted: 1, duplicates: 1 });
    const second = await call("/api/events/batches", batch("chrome", dup, fieldEvent("e2", "2026-11-22T10:00:01Z")));
    expect(await second.json()).toEqual({ accepted: 1, duplicates: 1 });
    expect(await opened.db.select().from(eventsTable)).toHaveLength(2);
  });

  it("rejects a malformed envelope with field errors and writes nothing", async () => {
    const bad = { type: "field_filled", id: "e2", ts: "not-a-time", payload: {} };
    const res = await call("/api/events/batches", batch("chrome", fieldEvent("e1", "2026-11-22T10:00:00Z"), bad));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.fields.events).toBeDefined();
    expect(await opened.db.select().from(eventsTable)).toHaveLength(0);
    expect((await call("/api/sessions/s1")).status).toBe(404);
  });

  it("rejects a missing session", async () => {
    const res = await call("/api/events/batches", { events: [] });
    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).fields)).toContain("session");
  });
});

describe("session timeline", () => {
  it("orders events, traces and revisions by captured time", async () => {
    await call(
      "/api/events/batches",
      batch(
        "chrome",
        fieldEvent("late", "2026-11-22T10:00:30Z"),
        fieldEvent("early", "2026-11-22T10:00:00Z"),
      ),
    );
    await opened.db.insert(agentTasks).values({
      id: "task1",
      sessionId: "s1",
      kind: "infer",
      status: "done",
      startedAt: "2026-11-22T10:00:00Z",
    });
    await insertTrace(opened.db, {
      id: "tr1",
      taskId: "task1",
      sessionId: "s1",
      step: "infer",
      input: {},
      reasoning: "why",
      createdAt: "2026-11-22T10:00:10Z",
    });
    await insertRevision(opened.db, {
      id: "rev1",
      entityType: "profile",
      entityId: "p1",
      sourceSessionId: "s1",
      actor: "agent",
      createdAt: "2026-11-22T10:00:20Z",
    });
    const detail = await (await call("/api/sessions/s1")).json();
    const order = detail.timeline.map((e: { kind: string; data: { id: string } }) => `${e.kind}:${e.data.id}`);
    expect(order).toEqual(["event:early", "trace:tr1", "revision:rev1", "event:late"]);
  });

  it("lists sessions and survives reopening the database", async () => {
    await call("/api/events/batches", batch("chrome", fieldEvent("e1", "2026-11-22T10:00:00Z")));
    await running.close();
    opened.close();
    opened = openDatabase(join(dir, "dex-ai.sqlite"));
    await boot();
    const list = await (await call("/api/sessions")).json();
    expect(list).toMatchObject([{ id: "s1" }]);
    const detail = await (await call("/api/sessions/s1")).json();
    expect(detail.timeline).toMatchObject([{ kind: "event", data: { id: "e1" } }]);
  });
});
