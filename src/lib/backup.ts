import "server-only";
import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR, getSqlite } from "./db";
import { todayManila } from "./dates";

export const BACKUP_PREFIX = "gastos-";

export function backupKeep(): number {
  const n = Number(process.env.BACKUP_KEEP);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 14;
}

export function listBackups(): { name: string; size: number; mtime: string }[] {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(".db"))
    .map((name) => {
      const st = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

export async function createBackup(label = todayManila()): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${BACKUP_PREFIX}${label}.db`);
  const tmp = `${file}.tmp`;
  await getSqlite().backup(tmp);
  fs.renameSync(tmp, file);
  prune();
  return file;
}

export function prune(keep = backupKeep()) {
  const files = listBackups();
  for (const f of files.slice(keep)) fs.rmSync(path.join(BACKUP_DIR, f.name), { force: true });
}

export function hasBackupForToday(): boolean {
  return fs.existsSync(path.join(BACKUP_DIR, `${BACKUP_PREFIX}${todayManila()}.db`));
}

let timer: NodeJS.Timeout | null = null;

export function startBackupScheduler() {
  if (timer) return;
  const hour = Number(process.env.BACKUP_HOUR ?? 3);
  const tick = async () => {
    try {
      const manilaHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hour12: false }).format(new Date()));
      if (manilaHour >= hour && !hasBackupForToday()) {
        const f = await createBackup();
        console.log(`[backup] wrote ${f}`);
      }
    } catch (err) {
      console.error("[backup] failed", err);
    }
  };
  timer = setInterval(tick, 15 * 60 * 1000);
  timer.unref();
  void tick();
}
