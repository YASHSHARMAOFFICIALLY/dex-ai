import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";
import { WebSocketServer } from "ws";
import { findWsProtocol } from "./auth";
import type { Config } from "./config";
import type { Hub } from "./stream/hub";

export type RunningServer = { server: Server; close: () => Promise<void> };

export async function startServer(app: Hono, config: Config, hub: Hub): Promise<RunningServer> {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      const offered = [...protocols].join(",");
      return findWsProtocol(offered, config.token) ?? false;
    },
  });
  const server = await new Promise<Server>((resolve) => {
    const created = serve(
      { fetch: app.fetch, port: config.port, hostname: config.host, websocket: { server: wss } },
      () => resolve(created as Server),
    );
  });

  async function close(): Promise<void> {
    hub.close();
    wss.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
  return { server, close };
}
