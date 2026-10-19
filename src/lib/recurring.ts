import "server-only";
import { and, eq, isNull, lte, or, gte } from "drizzle-orm";
import { getDb, schema } from "./db";
import { currentMonth, addMonths, dueDateFor } from "./dates";

const { recurring, bills } = schema;

export function ensureRecurringBills(months: string[] = [currentMonth(), addMonths(currentMonth(), 1)]) {
  const db = getDb();
  const active = db.select().from(recurring).where(eq(recurring.paused, false)).all();
  if (!active.length) return;
  db.transaction((tx) => {
    for (const r of active) {
      for (const month of months) {
        if (month < r.startMonth) continue;
        if (r.endMonth && month > r.endMonth) continue;
        const exists = tx
          .select({ id: bills.id })
          .from(bills)
          .where(and(eq(bills.recurringId, r.id), eq(bills.billingMonth, month)))
          .get();
        if (exists) continue;
        tx.insert(bills)
          .values({
            name: r.name,
            categoryId: r.categoryId,
            billingMonth: month,
            amount: r.amount,
            dueDate: dueDateFor(month, r.dueDay, r.dueDaysBefore),
            recurringId: r.id,
            notes: r.notes,
          })
          .run();
      }
    }
  });
}

export function activeRecurringFor(month: string) {
  const db = getDb();
  return db
    .select()
    .from(recurring)
    .where(and(eq(recurring.paused, false), lte(recurring.startMonth, month), or(isNull(recurring.endMonth), gte(recurring.endMonth, month))))
    .all();
}
