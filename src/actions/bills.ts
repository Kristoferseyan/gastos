"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { billSchema, zodError, type ActionResult } from "@/lib/validation";
import { todayManila } from "@/lib/dates";
import { fmtMonth } from "@/lib/dates";

const { bills, transactions } = schema;

function revalidateAll() {
  for (const p of ["/", "/transactions", "/bills", "/utilities", "/monthly", "/reports"]) revalidatePath(p);
}

function billNote(name: string, month: string, consumption: number | null, unit: string | null) {
  const base = `${name} — ${fmtMonth(month)}`;
  return consumption != null ? `${base} (${consumption} ${unit ?? ""})`.replace(/\s+\)/, ")") : base;
}

export async function createBill(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  const id = db.transaction((tx) => {
    const row = tx.insert(bills).values(parsed.data).returning({ id: bills.id }).get();
    if (parsed.data.paidDate) recordPayment(tx, row.id, parsed.data.paidDate);
    return row.id;
  });
  revalidateAll();
  return { ok: true, data: { id } };
}

export async function updateBill(id: number, input: unknown): Promise<ActionResult> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  const existing = db.select().from(bills).where(eq(bills.id, id)).get();
  if (!existing) return { ok: false, error: "That bill no longer exists" };
  db.transaction((tx) => {
    tx.update(bills).set(parsed.data).where(eq(bills.id, id)).run();
    const cat = tx.select().from(schema.categories).where(eq(schema.categories.id, parsed.data.categoryId)).get();
    if (parsed.data.paidDate && existing.transactionId) {
      tx.update(transactions)
        .set({
          amount: parsed.data.amount,
          date: parsed.data.paidDate,
          categoryId: parsed.data.categoryId,
          note: billNote(parsed.data.name, parsed.data.billingMonth, parsed.data.consumption, cat?.utilityUnit ?? null),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, existing.transactionId))
        .run();
    } else if (parsed.data.paidDate && !existing.transactionId) {
      recordPayment(tx, id, parsed.data.paidDate);
    } else if (!parsed.data.paidDate && existing.transactionId) {
      tx.delete(transactions).where(eq(transactions.id, existing.transactionId)).run();
      tx.update(bills).set({ transactionId: null }).where(eq(bills.id, id)).run();
    }
  });
  revalidateAll();
  return { ok: true };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function recordPayment(tx: Tx, billId: number, paidDate: string) {
  const bill = tx.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) return;
  const cat = tx.select().from(schema.categories).where(eq(schema.categories.id, bill.categoryId)).get();
  const t = tx
    .insert(transactions)
    .values({
      date: paidDate,
      amount: bill.amount,
      categoryId: bill.categoryId,
      note: billNote(bill.name, bill.billingMonth, bill.consumption, cat?.utilityUnit ?? null),
      type: "recurring",
      billId,
      tags: "bill",
    })
    .returning({ id: transactions.id })
    .get();
  tx.update(bills).set({ paidDate, transactionId: t.id }).where(eq(bills.id, billId)).run();
}

export async function markBillPaid(id: number, paidDate?: string): Promise<ActionResult> {
  const db = getDb();
  const bill = db.select().from(bills).where(eq(bills.id, id)).get();
  if (!bill) return { ok: false, error: "That bill no longer exists" };
  if (bill.paidDate) return { ok: false, error: "Already marked paid" };
  db.transaction((tx) => recordPayment(tx, id, paidDate || todayManila()));
  revalidateAll();
  return { ok: true };
}

export async function markBillUnpaid(id: number): Promise<ActionResult> {
  const db = getDb();
  const bill = db.select().from(bills).where(eq(bills.id, id)).get();
  if (!bill) return { ok: false, error: "That bill no longer exists" };
  db.transaction((tx) => {
    if (bill.transactionId) tx.delete(transactions).where(eq(transactions.id, bill.transactionId)).run();
    tx.update(bills).set({ paidDate: null, transactionId: null }).where(eq(bills.id, id)).run();
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteBill(id: number, deletePayment = false): Promise<ActionResult> {
  const db = getDb();
  const bill = db.select().from(bills).where(eq(bills.id, id)).get();
  if (!bill) return { ok: false, error: "Already deleted" };
  db.transaction((tx) => {
    if (bill.transactionId) {
      if (deletePayment) tx.delete(transactions).where(eq(transactions.id, bill.transactionId)).run();
      else tx.update(transactions).set({ billId: null }).where(eq(transactions.id, bill.transactionId)).run();
    }
    tx.delete(bills).where(eq(bills.id, id)).run();
  });
  revalidateAll();
  return { ok: true };
}
