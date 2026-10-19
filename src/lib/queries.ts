import "server-only";
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { addMonths, currentMonth, daysUntil, lastMonths, monthRange, todayManila } from "./dates";
import { ensureRecurringBills } from "./recurring";
import type { Bill, Category, CategoryGroup, Transaction, TxType } from "./db/schema";

const { categories, transactions, bills, recurring, income, settings } = schema;

export type BillStatus = "paid" | "unpaid" | "overdue";
export type BillRow = Bill & { category: Category; status: BillStatus };
export type TxRow = Transaction & { category: Category };

export function billStatus(b: Pick<Bill, "paidDate" | "dueDate">, today = todayManila()): BillStatus {
  if (b.paidDate) return "paid";
  if (b.dueDate && b.dueDate < today) return "overdue";
  return "unpaid";
}

export function listCategories(includeArchived = false): Category[] {
  const db = getDb();
  const q = db.select().from(categories).orderBy(asc(categories.sort), asc(categories.name));
  return includeArchived ? q.all() : q.where(eq(categories.archived, false)).all();
}

export function categoryMap(): Map<number, Category> {
  return new Map(listCategories(true).map((c) => [c.id, c]));
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? fallback;
}

export function incomeEnabled(): boolean {
  return getSetting("income_enabled", "0") === "1";
}

export type TxFilter = {
  month?: string;
  categoryId?: number;
  type?: TxType;
  q?: string;
  limit?: number;
  from?: string;
  to?: string;
};

export function listTransactions(f: TxFilter = {}): TxRow[] {
  const db = getDb();
  const where = [];
  if (f.month) {
    const { start, end } = monthRange(f.month);
    where.push(gte(transactions.date, start), lte(transactions.date, end));
  }
  if (f.from) where.push(gte(transactions.date, f.from));
  if (f.to) where.push(lte(transactions.date, f.to));
  if (f.categoryId) where.push(eq(transactions.categoryId, f.categoryId));
  if (f.type) where.push(eq(transactions.type, f.type));
  if (f.q) {
    const term = `%${f.q.replace(/[%_]/g, "")}%`;
    where.push(or(like(transactions.note, term), like(transactions.tags, term), like(transactions.paymentMethod, term)));
  }
  const cats = categoryMap();
  let q = db
    .select()
    .from(transactions)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .$dynamic();
  if (f.limit) q = q.limit(f.limit);
  return q.all().map((t) => ({ ...t, category: cats.get(t.categoryId)! }));
}

export function getTransaction(id: number): TxRow | null {
  const t = getDb().select().from(transactions).where(eq(transactions.id, id)).get();
  if (!t) return null;
  return { ...t, category: categoryMap().get(t.categoryId)! };
}

export function listBills(f: { month?: string; categoryIds?: number[]; status?: BillStatus } = {}): BillRow[] {
  const db = getDb();
  const where = [];
  if (f.month) where.push(eq(bills.billingMonth, f.month));
  if (f.categoryIds?.length) where.push(inArray(bills.categoryId, f.categoryIds));
  const cats = categoryMap();
  const rows = db
    .select()
    .from(bills)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(bills.billingMonth), asc(bills.dueDate), asc(bills.id))
    .all()
    .map((b) => ({ ...b, category: cats.get(b.categoryId)!, status: billStatus(b) }));
  return f.status ? rows.filter((b) => b.status === f.status) : rows;
}

export function getBill(id: number): BillRow | null {
  const b = getDb().select().from(bills).where(eq(bills.id, id)).get();
  if (!b) return null;
  return { ...b, category: categoryMap().get(b.categoryId)!, status: billStatus(b) };
}

export function listRecurring() {
  const cats = categoryMap();
  return getDb()
    .select()
    .from(recurring)
    .orderBy(asc(recurring.dueDay), asc(recurring.name))
    .all()
    .map((r) => ({ ...r, category: cats.get(r.categoryId)! }));
}

export function listIncome(month?: string) {
  const db = getDb();
  if (!month) return db.select().from(income).orderBy(desc(income.date), desc(income.id)).all();
  const { start, end } = monthRange(month);
  return db.select().from(income).where(and(gte(income.date, start), lte(income.date, end))).orderBy(desc(income.date)).all();
}

export type MonthSummary = {
  month: string;
  total: number;
  recurringTotal: number;
  variableTotal: number;
  setupTotal: number;
  normalized: number;
  apartment: number;
  byGroup: Record<CategoryGroup, number>;
  byCategory: { category: Category; total: number; count: number }[];
  income: number;
  count: number;
};

export function monthSummary(month: string): MonthSummary {
  const db = getDb();
  const { start, end } = monthRange(month);
  const rows = db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(gte(transactions.date, start), lte(transactions.date, end)))
    .groupBy(transactions.categoryId, transactions.type)
    .all();
  const cats = categoryMap();
  const byGroup: Record<CategoryGroup, number> = { rent: 0, utilities: 0, groceries: 0, household: 0, other: 0, personal: 0 };
  const byCat = new Map<number, { category: Category; total: number; count: number }>();
  let total = 0, recurringTotal = 0, variableTotal = 0, setupTotal = 0, count = 0;
  for (const r of rows) {
    const cat = cats.get(r.categoryId)!;
    total += r.total;
    count += r.count;
    if (r.type === "recurring") recurringTotal += r.total;
    else if (r.type === "variable") variableTotal += r.total;
    else setupTotal += r.total;
    if (r.type !== "setup") byGroup[cat.group] += r.total;
    const e = byCat.get(cat.id) ?? { category: cat, total: 0, count: 0 };
    e.total += r.total;
    e.count += r.count;
    byCat.set(cat.id, e);
  }
  const inc = db
    .select({ total: sql<number>`coalesce(sum(${income.amount}), 0)` })
    .from(income)
    .where(and(gte(income.date, start), lte(income.date, end)))
    .get();
  return {
    month,
    total,
    recurringTotal,
    variableTotal,
    setupTotal,
    normalized: total - setupTotal,
    apartment: total - setupTotal - byGroup.personal,
    byGroup,
    byCategory: [...byCat.values()].sort((a, b) => b.total - a.total),
    income: inc?.total ?? 0,
    count,
  };
}

export function monthsWithData(): string[] {
  const db = getDb();
  const tx = db.select({ m: sql<string>`substr(${transactions.date}, 1, 7)` }).from(transactions).groupBy(sql`substr(${transactions.date}, 1, 7)`).all();
  const bl = db.select({ m: bills.billingMonth }).from(bills).groupBy(bills.billingMonth).all();
  const set = new Set<string>([...tx.map((r) => r.m), ...bl.map((r) => r.m), currentMonth()]);
  return [...set].sort().reverse();
}

export function monthTrend(count = 6, from = currentMonth()) {
  return lastMonths(count, from).map((m) => monthSummary(m));
}

export function expectedRecurring(month: string): number {
  const rows = listBills({ month });
  const fromBills = rows.reduce((s, b) => s + b.amount, 0);
  return fromBills;
}

export type Dashboard = {
  month: string;
  summary: MonthSummary;
  previous: MonthSummary;
  dueSoon: BillRow[];
  overdue: BillRow[];
  monthBills: BillRow[];
  recent: TxRow[];
  trend: MonthSummary[];
  budgets: { category: Category; spent: number; budget: number; over: boolean }[];
  income: boolean;
};

export function dashboard(): Dashboard {
  ensureRecurringBills();
  const month = currentMonth();
  const summary = monthSummary(month);
  const previous = monthSummary(addMonths(month, -1));
  const all = listBills();
  const overdue = all.filter((b) => b.status === "overdue");
  const dueSoon = all
    .filter((b) => b.status === "unpaid" && (b.billingMonth <= month || (b.dueDate && daysUntil(b.dueDate) <= 14)))
    .sort((a, b) => ((a.dueDate ?? "9") < (b.dueDate ?? "9") ? -1 : 1));
  const monthBills = all.filter((b) => b.billingMonth === month);
  const recent = listTransactions({ limit: 8 });
  const trend = monthTrend(6);
  const budgets = listCategories()
    .filter((c) => c.budget && c.budget > 0)
    .map((c) => {
      const spent = summary.byCategory.find((x) => x.category.id === c.id)?.total ?? 0;
      return { category: c, spent, budget: c.budget!, over: spent > c.budget! };
    });
  return { month, summary, previous, dueSoon, overdue, monthBills, recent, trend, budgets, income: incomeEnabled() };
}

export function utilityHistory(categoryId: number, limit = 24) {
  return listBills({ categoryIds: [categoryId] }).slice(0, limit).reverse();
}

export function setupTotal(): { total: number; count: number } {
  const r = getDb()
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)`, count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.type, "setup"))
    .get();
  return { total: r?.total ?? 0, count: r?.count ?? 0 };
}

export function distinctPaymentMethods(): string[] {
  return getDb()
    .select({ m: transactions.paymentMethod })
    .from(transactions)
    .where(sql`${transactions.paymentMethod} is not null and ${transactions.paymentMethod} != ''`)
    .groupBy(transactions.paymentMethod)
    .all()
    .map((r) => r.m!)
    .sort();
}
