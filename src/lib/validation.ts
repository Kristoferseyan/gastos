import { z } from "zod";
import { CATEGORY_GROUPS, TX_TYPES } from "./db/schema";
import { isValidDate, isValidMonth } from "./dates";
import { toCentavos } from "./money";

export const dateSchema = z.string().refine(isValidDate, "Use a valid date (YYYY-MM-DD)");
export const monthSchema = z.string().refine(isValidMonth, "Use a valid month (YYYY-MM)");

export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const c = toCentavos(v);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 250.50" });
      return z.NEVER;
    }
    return c;
  })
  .refine((c) => c > 0 && c < 100_000_000_00, "Amount must be between ₱0.01 and ₱100,000,000");

const optionalAmount = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const c = toCentavos(v);
    if (c === null || c < 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 1500" });
      return z.NEVER;
    }
    return c;
  });

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a number" });
      return z.NEVER;
    }
    return n;
  });

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v || v.trim() === "") return null;
    if (!isValidDate(v)) {
      ctx.addIssue({ code: "custom", message: "Use a valid date" });
      return z.NEVER;
    }
    return v;
  });

const shortText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

export const transactionSchema = z.object({
  date: dateSchema,
  amount: amountSchema,
  categoryId: z.coerce.number().int().positive("Pick a category"),
  note: shortText(2000).default(""),
  type: z.enum(TX_TYPES),
  paymentMethod: shortText(60).nullable().default(null),
  tags: shortText(200).default(""),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const categorySchema = z.object({
  name: shortText(60).min(1, "Give the category a name"),
  group: z.enum(CATEGORY_GROUPS),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  budget: optionalAmount,
  utilityUnit: shortText(10).nullable().default(null),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const recurringSchema = z.object({
  name: shortText(80).min(1, "Give it a name"),
  categoryId: z.coerce.number().int().positive("Pick a category"),
  amount: amountSchema,
  dueDay: z.coerce.number().int().min(1).max(31),
  dueDaysBefore: z.coerce.number().int().min(0).max(31).default(0),
  startMonth: monthSchema,
  endMonth: z.union([monthSchema, z.literal(""), z.null(), z.undefined()]).transform((v) => (v ? v : null)),
  notes: shortText(500).default(""),
});
export type RecurringInput = z.infer<typeof recurringSchema>;

export const billSchema = z.object({
  name: shortText(80).min(1, "Give the bill a name"),
  categoryId: z.coerce.number().int().positive("Pick a category"),
  billingMonth: monthSchema,
  amount: amountSchema,
  dueDate: optionalDate,
  paidDate: optionalDate,
  notes: shortText(1000).default(""),
  consumption: optionalNumber,
});
export type BillInput = z.infer<typeof billSchema>;

export const incomeSchema = z.object({
  date: dateSchema,
  amount: amountSchema,
  source: shortText(80).default(""),
  note: shortText(500).default(""),
});
export type IncomeInput = z.infer<typeof incomeSchema>;

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodError(err: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = err.issues[0]?.message ?? "Check the form";
  return { ok: false, error: first, fieldErrors };
}
