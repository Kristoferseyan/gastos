import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const CATEGORY_GROUPS = ["rent", "utilities", "groceries", "household", "other", "personal"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const TX_TYPES = ["recurring", "variable", "setup"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  group: text("group", { enum: CATEGORY_GROUPS }).notNull().default("other"),
  color: text("color").notNull().default("#2a78d6"),
  budget: integer("budget"),
  utilityUnit: text("utility_unit"),
  sort: integer("sort").notNull().default(100),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
}, (t) => [uniqueIndex("categories_name_idx").on(t.name)]);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  note: text("note").notNull().default(""),
  type: text("type", { enum: TX_TYPES }).notNull().default("variable"),
  paymentMethod: text("payment_method"),
  tags: text("tags").notNull().default(""),
  billId: integer("bill_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [index("transactions_date_idx").on(t.date), index("transactions_category_idx").on(t.categoryId)]);

export const recurring = sqliteTable("recurring", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  amount: integer("amount").notNull(),
  dueDay: integer("due_day").notNull().default(1),
  dueDaysBefore: integer("due_days_before").notNull().default(0),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month"),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  billingMonth: text("billing_month").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  notes: text("notes").notNull().default(""),
  consumption: real("consumption"),
  recurringId: integer("recurring_id").references(() => recurring.id, { onDelete: "set null" }),
  transactionId: integer("transaction_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("bills_month_idx").on(t.billingMonth),
  uniqueIndex("bills_recurring_month_idx").on(t.recurringId, t.billingMonth),
]);

export const income = sqliteTable("income", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  source: text("source").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const CHAT_ROLES = ["user", "assistant"] as const;
export const CHAT_STATUS = ["done", "pending", "error"] as const;

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role", { enum: CHAT_ROLES }).notNull(),
  content: text("content").notNull().default(""),
  status: text("status", { enum: CHAT_STATUS }).notNull().default("done"),
  memoryChanges: text("memory_changes").notNull().default("[]"),
  loggedEntries: text("logged_entries").notNull().default("[]"),
  images: text("images").notNull().default("[]"),
  ms: integer("ms"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const memory = sqliteTable("memory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull(),
  fact: text("fact").notNull(),
  source: text("source").notNull().default("chat"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [index("memory_topic_idx").on(t.topic)]);

export type Category = typeof categories.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type MemoryFact = typeof memory.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Income = typeof income.$inferSelect;
