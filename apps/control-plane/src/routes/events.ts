import { randomUUID } from "node:crypto";
import { eventBatchRequestSchema, type EventBatchResponse } from "@dex-ai/shared";
import { Hono } from "hono";
import { z } from "zod";
import { withTransaction, type Database, type Sqlite } from "../db/client";
import { insertEvents } from "../repositories/events";
import { upsertSession } from "../repositories/sessions";
import type { Hub } from "../stream/hub";

type Deps = { db: Database; sqlite: Sqlite; hub: Hub };

export function eventRoutes({ db, sqlite, hub }: Deps): Hono {
  const routes = new Hono();
  routes.post("/events/batches", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = eventBatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors;
      return c.json({ error: "invalid_request", fields }, 400);
    }
    const { session, events } = parsed.data;
    const now = new Date().toISOString();
    const accepted = await withTransaction(sqlite, async () => {
      await upsertSession(db, session, now);
      return insertEvents(db, session.id, events);
    });
    hub.publish({
      type: "session.updated",
      id: randomUUID(),
      ts: now,
      payload: { session_id: session.id, status: "active" },
    });
    const response: EventBatchResponse = { accepted, duplicates: events.length - accepted };
    return c.json(response);
  });
  return routes;
}
