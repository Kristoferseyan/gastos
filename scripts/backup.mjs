// Standalone SQLite snapshot. Runs inside the container:
//   docker compose exec gastos node scripts/backup.mjs
// Writes DATA_DIR/backups/gastos-<label>.db and prunes to BACKUP_KEEP.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || "/data";
const KEEP = Number(process.env.BACKUP_KEEP) >= 1 ? Number(process.env.BACKUP_KEEP) : 14;
const label = process.argv[2] || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(DATA_DIR, "backups");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `gastos-${label}.db`);

const db = new Database(path.join(DATA_DIR, "gastos.db"), { readonly: true });
await db.backup(out + ".tmp");
db.close();
fs.renameSync(out + ".tmp", out);

const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("gastos-") && f.endsWith(".db"))
  .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
for (const { f } of files.slice(KEEP)) fs.rmSync(path.join(dir, f));
console.log(`backup written: ${out} (${files.length > KEEP ? files.length - KEEP : 0} old pruned, keeping ${KEEP})`);
