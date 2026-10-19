export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./lib/db");
  const { startBackupScheduler } = await import("./lib/backup");
  const { ensureRecurringBills } = await import("./lib/recurring");
  const { failAllPending } = await import("./lib/chat");
  getDb();
  ensureRecurringBills();
  failAllPending();
  startBackupScheduler();
  const timer = setInterval(() => {
    try {
      ensureRecurringBills();
    } catch (err) {
      console.error("[recurring] failed", err);
    }
  }, 60 * 60 * 1000);
  timer.unref();
}
