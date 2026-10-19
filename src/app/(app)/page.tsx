import Link from "next/link";
import { dashboard } from "@/lib/queries";
import { peso } from "@/lib/money";
import { fmtDateShort, fmtMonth, fmtMonthTiny, daysUntil, todayManila } from "@/lib/dates";
import { Money } from "@/components/Money";
import { StatTile } from "@/components/StatTile";
import { LivingCostBar } from "@/components/charts/LivingCostBar";
import { Bars } from "@/components/charts/Bars";
import { BillActions } from "@/components/BillActions";
import { TxList } from "@/components/TxList";
import { listCategories, distinctPaymentMethods } from "@/lib/queries";

export const dynamic = "force-dynamic";

const GROUP_LABEL = { rent: "Rent", utilities: "Utilities", groceries: "Groceries", household: "Household", other: "Other", personal: "Personal" } as const;
const GROUP_COLOR = { rent: "#2a78d6", utilities: "#eb6834", groceries: "#1baf7a", household: "#eda100", other: "#e87ba4", personal: "#8e5bd6" } as const;

export default function Dashboard() {
  const d = dashboard();
  const s = d.summary;
  const today = todayManila();
  const delta = s.normalized - d.previous.normalized;
  const paid = d.monthBills.filter((b) => b.status === "paid");
  const unpaid = d.monthBills.filter((b) => b.status !== "paid");
  const attention = [...d.overdue, ...d.dueSoon.filter((b) => !d.overdue.some((o) => o.id === b.id))];
  const categories = listCategories();
  const methods = distinctPaymentMethods();

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="label">{fmtMonth(d.month)}</div>
            <div className="mt-1 text-4xl font-semibold"><Money value={s.normalized} /></div>
            <div className="mt-1 text-sm text-muted">
              normal living cost this month
              {d.previous.normalized > 0 && (
                <span className={`num ml-2 ${delta > 0 ? "text-bad" : "text-good"}`}>
                  {delta > 0 ? "▲" : "▼"} {peso(Math.abs(delta))} vs last month
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="label">Actual spent</div>
            <div className="text-2xl font-semibold"><Money value={s.total} /></div>
            {s.setupTotal > 0 && <div className="text-xs text-setup">includes {peso(s.setupTotal)} move-in / setup</div>}
          </div>
        </div>
        <div className="mt-5">
          <LivingCostBar
            segments={(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => ({ label: GROUP_LABEL[g], value: s.byGroup[g], color: GROUP_COLOR[g] }))}
            setup={s.setupTotal}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Recurring / fixed" value={s.recurringTotal} hint={`${paid.length} of ${d.monthBills.length} bills paid`} />
        <StatTile label="Variable" value={s.variableTotal} hint="groceries, eating out, transport…" />
        <StatTile label="Move-in / setup" value={s.setupTotal} tone="setup" hint="excluded from living cost" />
        <StatTile label="Still due this month" value={unpaid.reduce((a, b) => a + b.amount, 0)} hint={`${unpaid.length} unpaid bill${unpaid.length === 1 ? "" : "s"}`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Bills needing attention</h2>
            <Link href="/bills" className="text-sm text-accent">All bills</Link>
          </div>
          {attention.length === 0 ? (
            <p className="text-sm text-muted">Nothing unpaid this month or due in the next 14 days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((b) => {
                const days = b.dueDate ? daysUntil(b.dueDate, today) : null;
                return (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <span className="dot" style={{ background: b.category.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{b.name} <span className="text-muted">· {fmtMonthTiny(b.billingMonth)}</span></div>
                      <div className="text-xs text-muted">
                        {b.status === "overdue" ? <span className="status status-overdue">Overdue {Math.abs(days!)}d</span> : days === null ? <span className="status status-unpaid">Unpaid</span> : days === 0 ? <span className="status status-unpaid">Due today</span> : <span className="status status-unpaid">Due in {days}d · {fmtDateShort(b.dueDate!)}</span>}
                      </div>
                    </div>
                    <Money value={b.amount} className="font-semibold" />
                    <BillActions bill={b} compact />
                  </li>
                );
              })}
            </ul>
          )}
          {d.monthBills.length > 0 && (
            <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
              This month: {paid.length} paid ({peso(paid.reduce((a, b) => a + b.amount, 0))}), {unpaid.length} unpaid ({peso(unpaid.reduce((a, b) => a + b.amount, 0))})
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Month over month</h2>
          <p className="mb-3 text-xs text-muted">Solid = normal living cost. Hatched = move-in / setup on top.</p>
          <Bars
            ariaLabel="Spending per month, last six months"
            data={d.trend.map((m) => ({ label: fmtMonthTiny(m.month), hint: fmtMonth(m.month), value: m.normalized, sub: m.setupTotal }))}
          />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Spend by category</h2>
          {s.byCategory.length === 0 ? (
            <p className="text-sm text-muted">No expenses yet this month.</p>
          ) : (
            <ul className="space-y-2.5">
              {s.byCategory.map(({ category, total }) => {
                const budget = d.budgets.find((b) => b.category.id === category.id);
                const pct = Math.min(100, (total / Math.max(1, budget ? budget.budget : s.byCategory[0].total)) * 100);
                return (
                  <li key={category.id}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="dot" style={{ background: category.color }} />
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      {budget?.over && <span className="status status-overdue">⚠ over budget</span>}
                      <Money value={total} className="font-medium" />
                    </div>
                    <div className="bar-track mt-1">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: budget?.over ? "var(--bad)" : category.color }} />
                    </div>
                    {budget && <div className="num mt-0.5 text-right text-[0.7rem] text-muted">{peso(total)} of {peso(budget.budget)} budget</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent</h2>
            <Link href="/transactions" className="text-sm text-accent">All entries</Link>
          </div>
          <TxList rows={d.recent} categories={categories} methods={methods} today={today} compact />
        </section>
      </div>
    </div>
  );
}
