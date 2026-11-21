import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  bearerAuth,
  hostAllowlist,
  isAllowedOrigin,
  loopbackOnly,
  originAllowlist,
  wsProtocolAuth,
} from "./auth";
import type { Config } from "./config";
import type { Database } from "./db/client";
import { healthRoutes } from "./routes/health";
import { fixtureRoutes, webRoutes } from "./routes/static";
import type { Hub } from "./stream/hub";

export type AppDeps = { config: Config; db: Database; hub: Hub };

function apiRoutes({ config, db }: AppDeps): Hono {
  const api = new Hono();
  api.use("*", loopbackOnly());
  api.use("*", hostAllowlist(config.port));
  api.use(
    "*",
    cors({
      origin: (origin) => (isAllowedOrigin(origin, config) ? origin : null),
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  );
  api.use("*", originAllowlist(config));
  api.use("*", bearerAuth(config.token));
  api.route("/", healthRoutes(db));
  return api;
}

function streamRoute({ config, hub }: AppDeps): Hono {
  const stream = new Hono();
  stream.get(
    "/stream",
    loopbackOnly(),
    hostAllowlist(config.port),
    originAllowlist(config),
    wsProtocolAuth(config.token),
    upgradeWebSocket(() => ({
      onOpen: (_event, ws) => hub.add(ws),
      onClose: (_event, ws) => hub.remove(ws),
    })),
  );
  return stream;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.route("/api", apiRoutes(deps));
  app.route("/", streamRoute(deps));
  app.route("/", fixtureRoutes(deps.config.dataDir));
  app.route("/", webRoutes());
  return app;
}
