"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { ensureRecurringBills } from "@/lib/recurring";
import { recurringSchema, zodError, type ActionResult } from "@/lib/validation";
import { currentMonth, dueDateFor } from "@/lib/dates";

const { recurring, bills } = schema;

function revalidateAll() {
  for (const p of ["/", "/bills", "/settings", "/monthly", "/reports"]) revalidatePath(p);
}

export async function createRecurring(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const row = getDb().insert(recurring).values(parsed.data).returning({ id: recurring.id }).get();
  ensureRecurringBills();
  revalidateAll();
  return { ok: true, data: { id: row.id } };
}

export async function updateRecurring(id: number, input: unknown): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  db.transaction((tx) => {
    tx.update(recurring).set(parsed.data).where(eq(recurring.id, id)).run();
    const unpaid = tx.select().from(bills).where(and(eq(bills.recurringId, id), isNull(bills.paidDate))).all();
    for (const b of unpaid) {
      if (b.billingMonth < parsed.data.startMonth || (parsed.data.endMonth && b.billingMonth > parsed.data.endMonth)) {
        tx.delete(bills).where(eq(bills.id, b.id)).run();
        continue;
      }
      if (b.billingMonth < currentMonth()) continue;
      tx.update(bills)
        .set({
          name: parsed.data.name,
          amount: parsed.data.amount,
          categoryId: parsed.data.categoryId,
          dueDate: dueDateFor(b.billingMonth, parsed.data.dueDay, parsed.data.dueDaysBefore),
        })
        .where(eq(bills.id, b.id))
        .run();
    }
  });
  ensureRecurringBills();
  revalidateAll();
  return { ok: true };
}

export async function setRecurringPaused(id: number, paused: boolean): Promise<ActionResult> {
  const db = getDb();
  db.transaction((tx) => {
    tx.update(recurring).set({ paused }).where(eq(recurring.id, id)).run();
    if (paused) {
      const future = tx.select().from(bills).where(and(eq(bills.recurringId, id), isNull(bills.paidDate))).all();
      for (const b of future) if (b.billingMonth > currentMonth()) tx.delete(bills).where(eq(bills.id, b.id)).run();
    }
  });
  if (!paused) ensureRecurringBills();
  revalidateAll();
  return { ok: true };
}

export async function deleteRecurring(id: number): Promise<ActionResult> {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(bills).where(and(eq(bills.recurringId, id), isNull(bills.paidDate))).run();
    tx.delete(recurring).where(eq(recurring.id, id)).run();
  });
  revalidateAll();
  return { ok: true };
}
