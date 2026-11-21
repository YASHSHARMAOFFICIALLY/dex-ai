import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  bearerAuth,
  findWsProtocol,
  hostAllowlist,
  isAllowedHost,
  isLoopbackAddress,
  loopbackOnly,
  originAllowlist,
  wsProtocolAuth,
} from "./auth";
import type { Config } from "./config";

const token = "a".repeat(64);
const config: Config = {
  token,
  host: "127.0.0.1",
  port: 4823,
  dataDir: "/d",
  allowedExtensionOrigins: ["chrome-extension://abc", "moz-extension://uuid-1"],
  uiOrigin: "http://127.0.0.1:4823",
  confidenceThreshold: 0.7,
  parakeetModelDir: "/m",
};

function buildApp(middleware: ReturnType<typeof bearerAuth>): Hono {
  const app = new Hono();
  app.use("*", middleware);
  app.get("/", (c) => c.text("ok"));
  return app;
}

function status(app: Hono, headers: Record<string, string> = {}, env?: object): Promise<number> {
  return Promise.resolve(app.request("/", { headers }, env)).then((res) => res.status);
}

describe("bearerAuth", () => {
  const app = buildApp(bearerAuth(token));
  it("rejects missing token", async () => {
    expect(await status(app)).toBe(401);
  });
  it("rejects wrong token", async () => {
    expect(await status(app, { authorization: `Bearer ${"b".repeat(64)}` })).toBe(401);
  });
  it("rejects wrong scheme", async () => {
    expect(await status(app, { authorization: token })).toBe(401);
  });
  it("accepts correct token", async () => {
    expect(await status(app, { authorization: `Bearer ${token}` })).toBe(200);
  });
});

describe("originAllowlist", () => {
  const app = buildApp(originAllowlist(config));
  it("rejects disallowed origin", async () => {
    expect(await status(app, { origin: "chrome-extension://evil" })).toBe(403);
    expect(await status(app, { origin: "https://example.com" })).toBe(403);
  });
  it("accepts chrome, firefox and ui origins", async () => {
    expect(await status(app, { origin: "chrome-extension://abc" })).toBe(200);
    expect(await status(app, { origin: "moz-extension://uuid-1" })).toBe(200);
    expect(await status(app, { origin: "http://127.0.0.1:4823" })).toBe(200);
  });
});

describe("hostAllowlist", () => {
  const app = buildApp(hostAllowlist(4823));
  it("rejects foreign host (DNS rebinding)", async () => {
    expect(await status(app, { host: "evil.com:4823" })).toBe(403);
    expect(await status(app, { host: "127.0.0.1:9999" })).toBe(403);
  });
  it("accepts loopback hosts", async () => {
    expect(isAllowedHost("localhost:4823", 4823)).toBe(true);
    expect(await status(app, { host: "127.0.0.1:4823" })).toBe(200);
  });
});

describe("loopbackOnly", () => {
  const app = buildApp(loopbackOnly());
  const envFor = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });
  it("rejects remote and unknown addresses", async () => {
    expect(await status(app, {}, envFor("192.168.1.5"))).toBe(403);
    expect(await status(app)).toBe(403);
  });
  it("accepts loopback", async () => {
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(await status(app, {}, envFor("127.0.0.1"))).toBe(200);
  });
});

describe("websocket subprotocol", () => {
  it("finds the matching protocol among several", () => {
    expect(findWsProtocol(`json, dex-ai.${token}`, token)).toBe(`dex-ai.${token}`);
  });
  it("rejects missing or wrong token", () => {
    expect(findWsProtocol(undefined, token)).toBeUndefined();
    expect(findWsProtocol("dex-ai.wrong", token)).toBeUndefined();
  });
  it("middleware enforces it", async () => {
    const app = buildApp(wsProtocolAuth(token));
    expect(await status(app)).toBe(401);
    expect(await status(app, { "sec-websocket-protocol": `dex-ai.${token}` })).toBe(200);
  });
});
