import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

const FIXTURE_PREFIX = "/fixtures/job";
const fixtureDir = fileURLToPath(new URL("../../fixtures/job-site", import.meta.url));
const webDistDir = fileURLToPath(new URL("../../../web/dist", import.meta.url));

type Submission = Record<string, unknown>;

function readSubmissions(file: string): Submission[] {
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")) as Submission[];
}

async function readBody(request: Request): Promise<Submission> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Submission;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export function fixtureRoutes(dataDir: string): Hono {
  const file = join(dataDir, "fixtures", "submissions.json");
  const routes = new Hono();

  routes.get(`${FIXTURE_PREFIX}/applications`, (c) => c.json(readSubmissions(file)));

  routes.post(`${FIXTURE_PREFIX}/applications`, async (c) => {
    const body = await readBody(c.req.raw);
    const submissions = readSubmissions(file);
    submissions.push({ ...body, received_at: new Date().toISOString() });
    mkdirSync(join(dataDir, "fixtures"), { recursive: true });
    writeFileSync(file, JSON.stringify(submissions, null, 2));
    return c.json({ recorded: true, count: submissions.length }, 201);
  });

  routes.get(
    `${FIXTURE_PREFIX}/*`,
    serveStatic({
      root: fixtureDir,
      rewriteRequestPath: (path) => path.slice(FIXTURE_PREFIX.length),
    }),
  );
  return routes;
}

export function webRoutes(): Hono {
  const routes = new Hono();
  if (existsSync(webDistDir)) {
    routes.get("*", serveStatic({ root: webDistDir }));
    return routes;
  }
  routes.get("/", (c) => c.text("Web UI not built. Run the web build.", 404));
  return routes;
}
