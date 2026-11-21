import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

type Method = "run" | "all" | "values" | "get";

function runStatement(sqlite: DatabaseSync, query: string, params: unknown[], method: Method) {
  const statement = sqlite.prepare(query);
  const args = params as SQLInputValue[];
  if (method === "run") {
    statement.run(...args);
    return { rows: [] };
  }
  statement.setReturnArrays(true);
  if (method === "get") {
    const row = statement.get(...args);
    return { rows: row === undefined ? [] : (row as unknown as unknown[]) };
  }
  return { rows: statement.all(...args) as unknown as unknown[][] };
}

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const db = drizzle(async (query, params, method) => runStatement(sqlite, query, params, method), {
    schema,
  });
  const close = () => sqlite.close();
  return { db, sqlite, close };
}

export type Database = ReturnType<typeof openDatabase>["db"];
export type Sqlite = DatabaseSync;

const transactionQueues = new WeakMap<Sqlite, Promise<unknown>>();

// Transactions on one connection run one at a time. fn must await only DB calls
// (they resolve as microtasks), never network or agent work, so no other request
// can slip statements into an open transaction.
export function withTransaction<T>(sqlite: Sqlite, fn: () => Promise<T>): Promise<T> {
  const previous = transactionQueues.get(sqlite) ?? Promise.resolve();
  const next = previous.then(
    () => runTransaction(sqlite, fn),
    () => runTransaction(sqlite, fn),
  );
  transactionQueues.set(sqlite, next.catch(() => undefined));
  return next;
}

async function runTransaction<T>(sqlite: Sqlite, fn: () => Promise<T>): Promise<T> {
  sqlite.prepare("BEGIN").run();
  try {
    const result = await fn();
    sqlite.prepare("COMMIT").run();
    return result;
  } catch (error) {
    sqlite.prepare("ROLLBACK").run();
    throw error;
  }
}
