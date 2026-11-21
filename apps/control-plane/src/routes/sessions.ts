import { Hono } from "hono";
import type { Database } from "../db/client";
import { getSession, listSessions } from "../repositories/sessions";
import { buildTimeline } from "../services/session-timeline";

export function sessionRoutes(db: Database): Hono {
  const routes = new Hono();
  routes.get("/sessions", async (c) => c.json(await listSessions(db)));
  routes.get("/sessions/:id", async (c) => {
    const session = await getSession(db, c.req.param("id"));
    if (!session) return c.json({ error: "not_found" }, 404);
    const timeline = await buildTimeline(db, session.id);
    return c.json({ session, timeline });
  });
  return routes;
}
