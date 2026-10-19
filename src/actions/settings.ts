"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { incomeSchema, zodError, type ActionResult } from "@/lib/validation";
import { createBackup, listBackups } from "@/lib/backup";

const { settings, income } = schema;

export async function setIncomeEnabled(enabled: boolean): Promise<ActionResult> {
  getDb().insert(settings).values({ key: "income_enabled", value: enabled ? "1" : "0" }).onConflictDoUpdate({ target: settings.key, set: { value: enabled ? "1" : "0" } }).run();
  for (const p of ["/", "/monthly", "/settings"]) revalidatePath(p);
  return { ok: true };
}

export async function createIncome(input: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  getDb().insert(income).values(parsed.data).run();
  for (const p of ["/", "/monthly", "/settings"]) revalidatePath(p);
  return { ok: true };
}

export async function deleteIncome(id: number): Promise<ActionResult> {
  getDb().delete(income).where(eq(income.id, id)).run();
  for (const p of ["/", "/monthly", "/settings"]) revalidatePath(p);
  return { ok: true };
}

export async function backupNow(): Promise<ActionResult<{ file: string; backups: ReturnType<typeof listBackups> }>> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = await createBackup(`manual-${stamp}`);
  revalidatePath("/settings");
  return { ok: true, data: { file, backups: listBackups() } };
}
