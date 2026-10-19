import "server-only";
import { listBills, listCategories, listRecurring, listTransactions, monthSummary, monthTrend, setupTotal, incomeEnabled, utilityHistory } from "./queries";
import { addMonths, currentMonth, daysUntil, duePhrase, fmtDate, fmtMonth, fmtMonthShort, todayManila } from "./dates";
import { peso } from "./money";
import { ensureRecurringBills } from "./recurring";
import type { CategoryGroup } from "./db/schema";

const GROUP_LABEL: Record<CategoryGroup, string> = { rent: "Rent", utilities: "Utilities", groceries: "Groceries", household: "Household", other: "Other", personal: "Personal subscriptions" };

function when(d: string | null, today: string): string {
  if (!d) return "no due date";
  const n = daysUntil(d, today);
  if (n < 0) return `${fmtDate(d)}, ${-n}d overdue`;
  if (n === 0) return `${fmtDate(d)}, due today`;
  return `${fmtDate(d)}, in ${n}d`;
}

export function financeSummaryText(): string {
  ensureRecurringBills();
  const today = todayManila();
  const month = currentMonth();
  const next = addMonths(month, 1);
  const s = monthSummary(month);
  const out: string[] = [];
  const line = (t = "") => out.push(t);

  line("# Gastos — personal finance snapshot");
  line(`As of ${fmtDate(today)} (Asia/Manila). Amounts are Philippine pesos. This is an apartment expense tracker: "normal living cost" excludes one-time move-in/setup purchases, which are listed separately.`);
  line();

  line(`## ${fmtMonth(month)} so far`);
  line(`Total actual spend: ${peso(s.total)} across ${s.count} entr${s.count === 1 ? "y" : "ies"}`);
  line(`Apartment living cost: ${peso(s.apartment)} (excludes move-in/setup and personal subscriptions)`);
  line(`Personal subscriptions: ${peso(s.byGroup.personal)}`);
  line(`Normal monthly cost (apartment + personal): ${peso(s.normalized)} (recurring ${peso(s.recurringTotal)} + variable ${peso(s.variableTotal)})`);
  if (s.setupTotal) line(`Move-in / setup purchases this month: ${peso(s.setupTotal)}`);
  if (incomeEnabled()) line(`Income logged: ${peso(s.income)}${s.income ? ` (net ${peso(s.income - s.total)})` : ""}`);
  const groups = (Object.keys(GROUP_LABEL) as CategoryGroup[]).filter((g) => s.byGroup[g] > 0);
  if (groups.length) line(`By line: ${groups.map((g) => `${GROUP_LABEL[g]} ${peso(s.byGroup[g])}`).join(" · ")}`);
  if (s.byCategory.length) line(`By category: ${s.byCategory.map((c) => `${c.category.name} ${peso(c.total)} (${c.count})`).join(" · ")}`);
  const budgets = listCategories().filter((c) => c.budget && c.budget > 0);
  if (budgets.length) {
    line(`Budgets: ${budgets.map((c) => {
      const spent = s.byCategory.find((x) => x.category.id === c.id)?.total ?? 0;
      return `${c.name} ${peso(spent)} of ${peso(c.budget!)} (${Math.round((spent / c.budget!) * 100)}%${spent > c.budget! ? ", OVER" : ""})`;
    }).join(" · ")}`);
  }
  const byMethod = listTransactions({ month }).reduce((m, t) => m.set(t.paymentMethod || "unspecified", (m.get(t.paymentMethod || "unspecified") ?? 0) + t.amount), new Map<string, number>());
  if (byMethod.size) line(`By payment method: ${[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${peso(v)}`).join(" · ")} (purchases are counted when made; a card bill payment is not an expense)`);
  line();

  line("## Bills");
  const bills = listBills();
  const fmtBill = (b: (typeof bills)[number]) => `${b.name} ${peso(b.amount)} (${b.paidDate ? `paid ${fmtDate(b.paidDate)}` : when(b.dueDate, today)})`;
  const overdue = bills.filter((b) => b.status === "overdue");
  const thisUnpaid = bills.filter((b) => b.billingMonth === month && b.status === "unpaid");
  const thisPaid = bills.filter((b) => b.billingMonth === month && b.status === "paid");
  const nextBills = bills.filter((b) => b.billingMonth === next && b.status !== "paid");
  line(`Overdue: ${overdue.length ? overdue.map(fmtBill).join("; ") : "none"}`);
  line(`Unpaid this month: ${thisUnpaid.length ? `${peso(thisUnpaid.reduce((a, b) => a + b.amount, 0))} — ${thisUnpaid.map(fmtBill).join("; ")}` : "none"}`);
  line(`Paid this month: ${thisPaid.length ? thisPaid.map(fmtBill).join("; ") : "none"}`);
  line(`Coming in ${fmtMonth(next)}: ${nextBills.length ? `${peso(nextBills.reduce((a, b) => a + b.amount, 0))} — ${nextBills.map(fmtBill).join("; ")}` : "nothing scheduled"}`);
  line();

  line("## Fixed monthly commitments (recurring)");
  const recAll = listRecurring();
  const rec = recAll.filter((r) => !r.paused);
  const fmtRec = (r: (typeof rec)[number]) => `- ${r.name}: ${peso(r.amount)} ${duePhrase(r.dueDay, r.dueDaysBefore)}${r.startMonth > month ? `, starts ${fmtMonthShort(r.startMonth)}` : ""}${r.endMonth ? `, ends ${fmtMonthShort(r.endMonth)}` : ""}`;
  const recApt = rec.filter((r) => r.category.group !== "personal");
  const recPersonal = rec.filter((r) => r.category.group === "personal");
  line(`Apartment (${peso(recApt.reduce((a, r) => a + r.amount, 0))}/month, utilities excluded until billed):`);
  if (recApt.length) for (const r of recApt) line(fmtRec(r)); else line("- none");
  line(`Personal (${peso(recPersonal.reduce((a, r) => a + r.amount, 0))}/month):`);
  if (recPersonal.length) for (const r of recPersonal) line(fmtRec(r)); else line("- none");
  line(`Known fixed commitments: ${peso(rec.reduce((a, r) => a + r.amount, 0))} per month`);
  const paused = recAll.filter((r) => r.paused);
  if (paused.length) line(`Paused / not active yet: ${paused.map((r) => `${r.name} ${peso(r.amount)}`).join(", ")}`);
  line();

  const utilities = listCategories().filter((c) => c.group === "utilities");
  if (utilities.length) {
    line("## Utilities history");
    for (const u of utilities) {
      const h = utilityHistory(u.id);
      if (!h.length) {
        line(`- ${u.name}: no bills recorded yet`);
        continue;
      }
      const last = h[h.length - 1];
      const avg = Math.round(h.reduce((a, b) => a + b.amount, 0) / h.length);
      line(`- ${u.name}: ${h.length} bill${h.length === 1 ? "" : "s"}, latest ${peso(last.amount)} for ${fmtMonthShort(last.billingMonth)}${last.consumption != null ? ` (${last.consumption} ${u.utilityUnit ?? ""})` : ""}, average ${peso(avg)}`);
    }
    line();
  }

  const trend = monthTrend(6).filter((m) => m.count > 0 || m.month === month);
  line("## Monthly totals");
  for (const m of trend) line(`- ${fmtMonthShort(m.month)}: total ${peso(m.total)}, normal living cost ${peso(m.normalized)}${m.setupTotal ? `, setup ${peso(m.setupTotal)}` : ""}`);
  line();

  const setup = setupTotal();
  if (setup.count) {
    line(`## Move-in / setup purchases to date: ${peso(setup.total)} (${setup.count} entr${setup.count === 1 ? "y" : "ies"})`);
    line();
  }

  const recent = listTransactions({ limit: 25 });
  line(`## Recent entries (last ${recent.length})`);
  for (const t of recent) {
    const note = t.note.replace(/\s*\n+\s*/g, "; ").replace(/^; /, "").trim();
    line(`- ${t.date} · ${t.category.name} · ${note ? (note.length > 160 ? note.slice(0, 157) + "…" : note) : "(no note)"} · ${peso(t.amount)} · ${t.type}${t.paymentMethod ? ` · ${t.paymentMethod}` : ""}`);
  }
  return out.join("\n");
}
