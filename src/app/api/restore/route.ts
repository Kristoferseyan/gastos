import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, getSqlite, schema } from "@/lib/db";
import { createBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

const row = z.record(z.string(), z.unknown());
const payloadSchema = z.object({
  app: z.literal("gastos"),
  version: z.literal(1),
  categories: z.array(row),
  recurring: z.array(row),
  bills: z.array(row),
  transactions: z.array(row),
  income: z.array(row).default([]),
  settings: z.array(row).default([]),
  memory: z.array(row).optional(),
  chatMessages: z.array(row).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a backup .json file" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return Response.json({ error: "File is too large" }, { status: 400 });
    json = JSON.parse(await file.text());
  } catch {
    return Response.json({ error: "That file is not valid JSON" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "That file is not a Gastos backup" }, { status: 400 });
  const data = parsed.data;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await createBackup(`pre-restore-${stamp}`);

  const db = getDb();
  const sqlite = getSqlite();
  try {
    sqlite.pragma("foreign_keys = OFF");
    db.transaction((tx) => {
      tx.delete(schema.transactions).run();
      tx.delete(schema.bills).run();
      tx.delete(schema.recurring).run();
      tx.delete(schema.income).run();
      tx.delete(schema.categories).run();
      tx.delete(schema.settings).run();
      if (data.categories.length) tx.insert(schema.categories).values(data.categories as never).run();
      if (data.recurring.length) tx.insert(schema.recurring).values(data.recurring as never).run();
      if (data.bills.length) tx.insert(schema.bills).values(data.bills as never).run();
      if (data.transactions.length) tx.insert(schema.transactions).values(data.transactions as never).run();
      if (data.income.length) tx.insert(schema.income).values(data.income as never).run();
      const settings = data.settings.length ? data.settings : [{ key: "seeded", value: "1" }];
      if (!settings.some((s) => s.key === "seeded")) settings.push({ key: "seeded", value: "1" });
      tx.insert(schema.settings).values(settings as never).run();
      // backups from before the Ask chat have no memory section; leave the live memory alone then
      if (data.memory) {
        tx.delete(schema.memory).run();
        if (data.memory.length) tx.insert(schema.memory).values(data.memory as never).run();
      }
      if (data.chatMessages) {
        tx.delete(schema.chatMessages).run();
        if (data.chatMessages.length) tx.insert(schema.chatMessages).values(data.chatMessages as never).run();
      }
    });
  } catch (err) {
    return Response.json({ error: `Restore failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  for (const p of ["/", "/transactions", "/bills", "/utilities", "/monthly", "/reports", "/settings", "/chat"]) revalidatePath(p);
  return Response.json({
    ok: true,
    counts: { categories: data.categories.length, transactions: data.transactions.length, bills: data.bills.length, recurring: data.recurring.length, memory: data.memory?.length ?? null },
  });
}
