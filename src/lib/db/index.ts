import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "gastos.db");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(process.cwd(), "drizzle");

export type DB = BetterSQLite3Database<typeof schema>;

declare global {
  var __gastos: { sqlite: Database.Database; db: DB } | undefined;
}

function open() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  seedIfEmpty(db);
  return { sqlite, db };
}

export function getDb(): DB {
  if (!globalThis.__gastos) globalThis.__gastos = open();
  return globalThis.__gastos.db;
}

export function getSqlite(): Database.Database {
  getDb();
  return globalThis.__gastos!.sqlite;
}

export { schema };
