import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";

export function healthRoutes(db: Database): Hono {
  const routes = new Hono();
  routes.get("/health", async (c) => {
    await db.run(sql`select 1`);
    return c.json({ status: "ok", ready: true });
  });
  return routes;
}
