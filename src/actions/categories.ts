"use server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { categorySchema, zodError, type ActionResult } from "@/lib/validation";

const { categories, transactions, bills, recurring } = schema;

function revalidateAll() {
  for (const p of ["/", "/transactions", "/bills", "/utilities", "/monthly", "/reports", "/settings"]) revalidatePath(p);
}

export async function createCategory(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  const dup = db.select().from(categories).where(eq(categories.name, parsed.data.name)).get();
  if (dup) return { ok: false, error: "A category with that name already exists", fieldErrors: { name: "Already exists" } };
  const max = db.select({ m: sql<number>`coalesce(max(${categories.sort}), 0)` }).from(categories).get();
  const row = db.insert(categories).values({ ...parsed.data, sort: (max?.m ?? 0) + 10 }).returning({ id: categories.id }).get();
  revalidateAll();
  return { ok: true, data: { id: row.id } };
}

export async function updateCategory(id: number, input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const db = getDb();
  const dup = db.select().from(categories).where(eq(categories.name, parsed.data.name)).get();
  if (dup && dup.id !== id) return { ok: false, error: "A category with that name already exists", fieldErrors: { name: "Already exists" } };
  db.update(categories).set(parsed.data).where(eq(categories.id, id)).run();
  revalidateAll();
  return { ok: true };
}

export async function setCategoryArchived(id: number, archived: boolean): Promise<ActionResult> {
  getDb().update(categories).set({ archived }).where(eq(categories.id, id)).run();
  revalidateAll();
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  const db = getDb();
  const used =
    (db.select({ n: sql<number>`count(*)` }).from(transactions).where(eq(transactions.categoryId, id)).get()?.n ?? 0) +
    (db.select({ n: sql<number>`count(*)` }).from(bills).where(eq(bills.categoryId, id)).get()?.n ?? 0) +
    (db.select({ n: sql<number>`count(*)` }).from(recurring).where(eq(recurring.categoryId, id)).get()?.n ?? 0);
  if (used > 0) return { ok: false, error: "This category is in use. Archive it instead, or move its entries first." };
  db.delete(categories).where(eq(categories.id, id)).run();
  revalidateAll();
  return { ok: true };
}
