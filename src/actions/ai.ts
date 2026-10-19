"use server";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { aiEnabled, parseReceiptText, type DraftItem } from "@/lib/ai";
import { todayManila } from "@/lib/dates";
import { listCategories } from "@/lib/queries";
import { transactionSchema, type ActionResult, type TransactionInput } from "@/lib/validation";

export async function parseReceipt(text: unknown): Promise<ActionResult<{ items: DraftItem[]; ms: number }>> {
  if (!aiEnabled()) return { ok: false, error: "Receipt AI is not configured on this server" };
  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return { ok: false, error: "Paste or type the receipt first" };
  if (t.length > 8000) return { ok: false, error: "That is too long. Keep it under 8,000 characters" };
  try {
    const result = await parseReceiptText(t, listCategories(true), todayManila());
    if (!result.items.length) return { ok: false, error: "No items with amounts were found in that text" };
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receipt AI failed" };
  }
}

export async function createTransactions(inputs: unknown): Promise<ActionResult<{ count: number }>> {
  if (!Array.isArray(inputs) || !inputs.length) return { ok: false, error: "Nothing to save" };
  if (inputs.length > 200) return { ok: false, error: "Too many entries at once (max 200)" };
  const rows: TransactionInput[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const parsed = transactionSchema.safeParse(inputs[i]);
    if (!parsed.success) return { ok: false, error: `Entry ${i + 1}: ${parsed.error.issues[0]?.message ?? "check the values"}` };
    rows.push(parsed.data);
  }
  const db = getDb();
  db.transaction((tx) => {
    for (const r of rows) tx.insert(schema.transactions).values(r).run();
  });
  for (const p of ["/", "/transactions", "/bills", "/utilities", "/monthly", "/reports"]) revalidatePath(p);
  return { ok: true, data: { count: rows.length } };
}
