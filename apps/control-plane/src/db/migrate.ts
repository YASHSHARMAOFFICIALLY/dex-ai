import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { withTransaction, type Database, type Sqlite } from "./client";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function runMigrations(db: Database, sqlite: Sqlite): Promise<void> {
  await migrate(
    db,
    async (queries) => {
      await withTransaction(sqlite, async () => {
        for (const query of queries) {
          sqlite.exec(query);
        }
      });
    },
    { migrationsFolder },
  );
}
