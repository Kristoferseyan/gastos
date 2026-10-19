import "server-only";
import { advisorContext, applyEntries, listMemory, memoryBlock, type RawEntry } from "./chat";
import { listBills, listCategories, listTransactions, monthSummary } from "./queries";
import { ensureRecurringBills } from "./recurring";
import { currentMonth, daysUntil, todayManila } from "./dates";
import { peso } from "./money";

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  run: (args: Record<string, unknown>) => string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function categoryId(name: string | undefined): number | undefined {
  if (!name) return undefined;
  const cat = listCategories(true).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) throw new Error(`Unknown category "${name}". Categories: ${listCategories().map((c) => c.name).join(", ")}`);
  return cat.id;
}

export function tools(): Tool[] {
  const categoryNames = listCategories().map((c) => c.name);
  return [
    {
      name: "finance_overview",
      description:
        "Live snapshot of the owner's money from Gastos, their expense tracker: last 3 months of entries, monthly totals, bills with due dates, recurring bills, utilities, budgets, income, plus their saved finance memory (balances, income, debts, goals, rules). Call this before any money advice or 'can I afford it' question. Pass their question so matching older entries are pulled in too.",
      inputSchema: { type: "object", properties: { question: { type: "string", description: "The owner's question, used to pull matching older entries" } } },
      run: (a) => `${advisorContext(str(a.question) ?? "")}\n\n# FINANCE MEMORY (saved in Gastos)\n${memoryBlock(listMemory())}`,
    },
    {
      name: "list_transactions",
      description: "Search the owner's recorded expenses in Gastos by month, date range, category or keyword. Amounts are Philippine pesos.",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM" },
          from: { type: "string", description: "YYYY-MM-DD, inclusive" },
          to: { type: "string", description: "YYYY-MM-DD, inclusive" },
          category: { type: "string", enum: categoryNames },
          search: { type: "string", description: "Matches note, tags or payment method" },
          limit: { type: "integer", minimum: 1, maximum: 300, default: 100 },
        },
      },
      run: (a) => {
        const month = str(a.month);
        const from = str(a.from);
        const to = str(a.to);
        if (month && !MONTH.test(month)) throw new Error("month must be YYYY-MM");
        if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw new Error("from/to must be YYYY-MM-DD");
        const limit = Math.min(300, Math.max(1, Number(a.limit) || 100));
        const rows = listTransactions({ month, from, to, categoryId: categoryId(str(a.category)), q: str(a.search), limit });
        if (!rows.length) return "No matching entries.";
        const total = rows.reduce((s, t) => s + t.amount, 0);
        return [
          `${rows.length} entr${rows.length === 1 ? "y" : "ies"}${rows.length === limit ? " (limit reached; narrow the filter for more)" : ""}, total ${peso(total)}`,
          ...rows.map((t) => `- [${t.id}] ${t.date} · ${t.category.name} · ${t.note || "(no note)"} · ${peso(t.amount)} · ${t.type}${t.paymentMethod ? ` · ${t.paymentMethod}` : ""}`),
        ].join("\n");
      },
    },
    {
      name: "month_summary",
      description: "Totals for one month in Gastos: overall, recurring vs variable vs move-in setup, per category, and income.",
      inputSchema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM, default current month" } } },
      run: (a) => {
        const month = str(a.month) ?? currentMonth();
        if (!MONTH.test(month)) throw new Error("month must be YYYY-MM");
        const m = monthSummary(month);
        return [
          `${month}: total ${peso(m.total)} over ${m.count} entries (recurring ${peso(m.recurringTotal)}, variable ${peso(m.variableTotal)}, move-in setup ${peso(m.setupTotal)}; normal living cost ${peso(m.normalized)})`,
          `Income recorded: ${peso(m.income)}`,
          ...m.byCategory.filter((c) => c.count).map((c) => `- ${c.category.name}: ${peso(c.total)} (${c.count})`),
        ].join("\n");
      },
    },
    {
      name: "upcoming_bills",
      description: "The owner's unpaid and overdue bills in Gastos with due dates and days left.",
      inputSchema: { type: "object", properties: {} },
      run: () => {
        ensureRecurringBills();
        const today = todayManila();
        const bills = listBills()
          .filter((b) => b.status !== "paid")
          .sort((x, y) => ((x.dueDate ?? "9999") < (y.dueDate ?? "9999") ? -1 : 1));
        if (!bills.length) return "No unpaid bills.";
        const total = bills.reduce((s, b) => s + b.amount, 0);
        return [
          `${bills.length} unpaid, ${peso(total)} total (today ${today})`,
          ...bills.map((b) => `- ${b.name} (${b.category.name}) ${peso(b.amount)} · ${b.dueDate ? `due ${b.dueDate}, ${daysUntil(b.dueDate, today)} day(s)` : "no due date"} · ${b.status}`),
        ].join("\n");
      },
    },
    {
      name: "add_expenses",
      description:
        "Save new expense entries straight into Gastos. Use only when the owner asks to log, add or record spending. One entry per item; skip totals, VAT and change lines. Exact duplicates are skipped. Each saved entry is editable on the Gastos Transactions page.",
      inputSchema: {
        type: "object",
        required: ["entries"],
        properties: {
          entries: {
            type: "array",
            maxItems: 30,
            items: {
              type: "object",
              required: ["date", "amount", "category", "note"],
              properties: {
                date: { type: "string", description: "YYYY-MM-DD the money was spent (Asia/Manila)" },
                amount: { type: "number", description: "Pesos, e.g. 328.05" },
                category: { type: "string", enum: categoryNames },
                note: { type: "string", description: "What was bought, short Title Case, e.g. 'Jasmine Rice 5kg'" },
                type: { type: "string", enum: ["variable", "setup"], description: "setup only for one-time move-in purchases" },
                payment_method: { type: ["string", "null"], description: "Only when the owner states it" },
              },
            },
          },
        },
      },
      run: (a) => {
        const raw = Array.isArray(a.entries) ? (a.entries as RawEntry[]) : [];
        if (!raw.length) throw new Error("entries is empty");
        const logged = applyEntries(raw.map((e) => ({ ...e, type: e.type ?? "variable", payment_method: e.payment_method ?? null })));
        return logged
          .map((e) => (e.skipped ? `- skipped ${e.note || "entry"} (${e.skipped})` : `- saved [${e.id}] ${e.date} · ${e.category} · ${e.note} · ${peso(e.amount)}`))
          .join("\n");
      },
    },
  ];
}
