import { timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { Config } from "./config";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const WS_PROTOCOL_PREFIX = "dex-ai.";

type NodeEnv = { incoming?: { socket?: { remoteAddress?: string } } };

export function isLoopbackAddress(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK_ADDRESSES.has(address);
}

export function isAllowedHost(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function isAllowedOrigin(origin: string | undefined, config: Config): boolean {
  if (origin === undefined) return true;
  return origin === config.uiOrigin || config.allowedExtensionOrigins.includes(origin);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isValidBearer(header: string | undefined, token: string): boolean {
  if (header === undefined || !header.startsWith("Bearer ")) return false;
  return safeEqual(header.slice("Bearer ".length), token);
}

export function findWsProtocol(header: string | undefined, token: string): string | undefined {
  const expected = `${WS_PROTOCOL_PREFIX}${token}`;
  const offered = (header ?? "").split(",").map((value) => value.trim());
  return offered.find((value) => safeEqual(value, expected));
}

export function getRemoteAddress(c: Context): string | undefined {
  const env = c.env as NodeEnv | undefined;
  return env?.incoming?.socket?.remoteAddress;
}

function reject(c: Context, status: 401 | 403): Response {
  return c.json({ error: status === 401 ? "unauthorized" : "forbidden" }, status);
}

export function loopbackOnly(): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    if (!isLoopbackAddress(getRemoteAddress(c))) return reject(c, 403);
    await next();
  });
}

export function hostAllowlist(port: number): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    if (!isAllowedHost(c.req.header("host"), port)) return reject(c, 403);
    await next();
  });
}

export function originAllowlist(config: Config): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    if (!isAllowedOrigin(c.req.header("origin"), config)) return reject(c, 403);
    await next();
  });
}

export function bearerAuth(token: string): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    if (!isValidBearer(c.req.header("authorization"), token)) return reject(c, 401);
    await next();
  });
}

export function wsProtocolAuth(token: string): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const protocol = findWsProtocol(c.req.header("sec-websocket-protocol"), token);
    if (protocol === undefined) return reject(c, 401);
    await next();
  });
}
