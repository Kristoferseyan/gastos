"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { transactionSchema, zodError, type ActionResult } from "@/lib/validation";

const { transactions, bills } = schema;

function revalidateAll() {
  for (const p of ["/", "/transactions", "/bills", "/utilities", "/monthly", "/reports"]) revalidatePath(p);
}

export async function createTransaction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const row = getDb().insert(transactions).values(parsed.data).returning({ id: transactions.id }).get();
  revalidateAll();
  return { ok: true, data: { id: row.id } };
}

export async function updateTransaction(id: number, input: unknown): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  const existing = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!existing) return { ok: false, error: "That transaction no longer exists" };
  db.transaction((tx) => {
    tx.update(transactions).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(transactions.id, id)).run();
    if (existing.billId) {
      tx.update(bills).set({ amount: parsed.data.amount, paidDate: parsed.data.date }).where(eq(bills.id, existing.billId)).run();
    }
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  const db = getDb();
  const existing = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!existing) return { ok: false, error: "Already deleted" };
  db.transaction((tx) => {
    tx.delete(transactions).where(eq(transactions.id, id)).run();
    if (existing.billId) tx.update(bills).set({ paidDate: null, transactionId: null }).where(eq(bills.id, existing.billId)).run();
  });
  revalidateAll();
  return { ok: true };
}
