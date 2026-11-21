import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "./app";
import { parseConfig, type Config } from "./config";
import { openDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { startServer, type RunningServer } from "./server";
import { createHub } from "./stream/hub";

const TOKEN = "t".repeat(40);
const UI_ORIGIN = "http://127.0.0.1:5173";

let dir: string;
let config: Config;
let running: RunningServer;
let closeDb: () => void;
let hub: ReturnType<typeof createHub>;

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

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "dex-app-"));
  config = parseConfig({
    token: TOKEN,
    host: "127.0.0.1",
    port: await freePort(),
    dataDir: dir,
    allowedExtensionOrigins: [],
    uiOrigin: UI_ORIGIN,
    confidenceThreshold: 0.7,
    parakeetModelDir: join(dir, "models"),
  });
  const opened = openDatabase(join(dir, "dex-ai.sqlite"));
  closeDb = opened.close;
  await runMigrations(opened.db, opened.sqlite);
  hub = createHub();
  running = await startServer(createApp({ config, db: opened.db, sqlite: opened.sqlite, hub }), config, hub);
});

afterEach(async () => {
  await running.close();
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function url(path: string): string {
  return `http://127.0.0.1:${config.port}${path}`;
}

function authed(headers: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${TOKEN}`, ...headers };
}

function openSocket(protocols: string[]): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`, protocols);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("unexpected-response", (_req, res) => reject(new Error(`status ${res.statusCode}`)));
  });
}

describe("http app", () => {
  it("binds to loopback only", () => {
    const address = running.server.address();
    expect(address).toMatchObject({ address: "127.0.0.1", port: config.port });
  });

  it("serves health with a valid token", async () => {
    const res = await fetch(url("/api/health"), { headers: authed() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ready: true });
  });

  it("rejects api calls without or with a wrong token", async () => {
    expect((await fetch(url("/api/health"))).status).toBe(401);
    const wrong = await fetch(url("/api/health"), { headers: { authorization: "Bearer nope" } });
    expect(wrong.status).toBe(401);
  });

  it("rejects a disallowed origin and allows a missing or allowed one", async () => {
    const bad = await fetch(url("/api/health"), { headers: authed({ origin: "http://evil.test" }) });
    expect(bad.status).toBe(403);
    const good = await fetch(url("/api/health"), { headers: authed({ origin: UI_ORIGIN }) });
    expect(good.status).toBe(200);
    expect(good.headers.get("access-control-allow-origin")).toBe(UI_ORIGIN);
  });

  it("rejects a foreign host header", async () => {
    const status = await new Promise<number>((resolve) => {
      const request = httpRequest(
        { host: "127.0.0.1", port: config.port, path: "/api/health", headers: authed({ host: "evil.test" }) },
        (res) => resolve(res.statusCode ?? 0),
      );
      request.end();
    });
    expect(status).toBe(403);
  });

  it("applies cors only to api routes", async () => {
    const res = await fetch(url("/fixtures/job/index.html"), { headers: { origin: UI_ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("fixture routes", () => {
  it("serves fixture pages without auth", async () => {
    const res = await fetch(url("/fixtures/job/apply.html"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/fixtures/job/applications"');
  });

  it("records submissions in the data dir and never in the committed file", async () => {
    const committed = new URL("../fixtures/job-site/submissions.json", import.meta.url);
    const before = readFileSync(committed, "utf8");
    const form = new URLSearchParams({ full_name: "Ada", email: "ada@example.com" });
    const post = await fetch(url("/fixtures/job/applications"), { method: "POST", body: form });
    expect(post.status).toBe(201);
    const list = await (await fetch(url("/fixtures/job/applications"))).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ full_name: "Ada", email: "ada@example.com" });
    expect(existsSync(join(dir, "fixtures", "submissions.json"))).toBe(true);
    expect(readFileSync(committed, "utf8")).toBe(before);
  });
});

describe("stream", () => {
  it("rejects sockets without the token subprotocol", async () => {
    await expect(openSocket(["dex-ai.wrong"])).rejects.toThrow("status 401");
  });

  it("fans events out to authorized subscribers only", async () => {
    const one = await openSocket([`dex-ai.${TOKEN}`]);
    const two = await openSocket([`dex-ai.${TOKEN}`]);
    expect(one.protocol).toBe(`dex-ai.${TOKEN}`);
    await expect(openSocket(["dex-ai.wrong"])).rejects.toThrow();
    const received = [one, two].map(
      (socket) => new Promise<string>((resolve) => socket.once("message", (m) => resolve(String(m)))),
    );
    const envelope = {
      type: "session.updated",
      id: "evt-1",
      ts: "2026-11-22T00:00:00.000Z",
      payload: { session_id: "s1", status: "active" },
    };
    hub.publish(envelope);
    for (const message of await Promise.all(received)) {
      expect(JSON.parse(message)).toEqual(envelope);
    }
    one.close();
    two.close();
  });

  it("rejects sockets from a disallowed origin", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`, [`dex-ai.${TOKEN}`], {
      origin: "http://evil.test",
    });
    const status = await new Promise<number>((resolve) => {
      socket.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    });
    expect(status).toBe(403);
  });
});
