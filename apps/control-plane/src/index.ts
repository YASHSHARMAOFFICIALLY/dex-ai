import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { startServer } from "./server";
import { createHub } from "./stream/hub";

async function main(): Promise<void> {
  const config = loadConfig();
  mkdirSync(config.dataDir, { recursive: true });
  const { db, sqlite, close: closeDb } = openDatabase(join(config.dataDir, "dex-ai.sqlite"));
  await runMigrations(db, sqlite);

  const hub = createHub();
  const app = createApp({ config, db, hub });
  const running = await startServer(app, config, hub);
  console.log(`control plane listening on http://${config.host}:${config.port}`);

  let stopping = false;
  async function shutdown(): Promise<void> {
    if (stopping) return;
    stopping = true;
    await running.close();
    closeDb();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
