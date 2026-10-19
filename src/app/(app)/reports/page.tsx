import { listBills, listCategories, listRecurring, monthTrend, monthsWithData, setupTotal, listTransactions } from "@/lib/queries";
import { activeRecurringFor } from "@/lib/recurring";
import { currentMonth, fmtMonth, fmtMonthShort, fmtDate } from "@/lib/dates";
import { peso } from "@/lib/money";
import { Money } from "@/components/Money";
import { Bars } from "@/components/charts/Bars";
import { RestorePanel } from "@/components/RestorePanel";
import { CopyText } from "@/components/CopyText";
import { financeSummaryText } from "@/lib/summary";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const months = monthsWithData().slice(0, 12).reverse();
  const summaries = months.map((m) => monthTrend(1, m)[0]);
  const categories = listCategories(true).filter((c) => summaries.some((s) => s.byCategory.some((b) => b.category.id === c.id)));
  const utilities = listCategories().filter((c) => c.group === "utilities");
  const utilityBills = listBills({ categoryIds: utilities.map((u) => u.id) });
  const setup = setupTotal();
  const setupRows = listTransactions({ type: "setup" });
  const recurringNow = activeRecurringFor(currentMonth());
  const recurringMonthly = recurringNow.reduce((s, r) => s + r.amount, 0);
  const recurringAll = listRecurring();
  const catGroup = new Map(listCategories(true).map((c) => [c.id, c.group]));
  const recurringPersonal = recurringNow.filter((r) => catGroup.get(r.categoryId) === "personal");
  const recurringApartment = recurringNow.filter((r) => catGroup.get(r.categoryId) !== "personal");
  const avgUtilities = (() => {
    const byMonth = new Map<string, number>();
    for (const b of utilityBills) byMonth.set(b.billingMonth, (byMonth.get(b.billingMonth) ?? 0) + b.amount);
    return byMonth.size ? Math.round([...byMonth.values()].reduce((a, b) => a + b, 0) / byMonth.size) : 0;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>
        <div className="flex gap-2">
          <a className="btn btn-sm" href="/api/export/csv">Export CSV</a>
          <a className="btn btn-sm" href="/api/export/json">Backup JSON</a>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Snapshot for an AI chat</h2>
        <p className="mb-3 text-sm text-muted">Plain text with this month, bills, recurring commitments, utilities, monthly totals and recent entries. Paste it into ChatGPT to ask about your finances.</p>
        <CopyText text={financeSummaryText()} />
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card p-5">
          <div className="label">Monthly fixed commitments</div>
          <div className="mt-1 text-2xl font-semibold"><Money value={recurringMonthly + avgUtilities} /></div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li className="label mt-1">Apartment · {peso(recurringApartment.reduce((a, r) => a + r.amount, 0) + avgUtilities)}</li>
            {recurringApartment.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="num">{peso(r.amount)}</span></li>)}
            <li className="flex justify-between"><span>Utilities (avg of recorded bills)</span><span className="num">{avgUtilities ? peso(avgUtilities) : "not yet known"}</span></li>
            <li className="label mt-2">Personal · {peso(recurringPersonal.reduce((a, r) => a + r.amount, 0))}</li>
            {recurringPersonal.length ? recurringPersonal.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="num">{peso(r.amount)}</span></li>) : <li>none</li>}
          </ul>
        </section>
        <section className="card p-5">
          <div className="label">Move-in / setup total</div>
          <div className="mt-1 text-2xl font-semibold text-setup"><Money value={setup.total} /></div>
          <p className="mt-2 text-sm text-muted">{setup.count} one-time purchase{setup.count === 1 ? "" : "s"}, kept out of the monthly living cost.</p>
        </section>
        <section className="card p-5">
          <div className="label">Recurring expenses</div>
          <ul className="mt-2 space-y-1 text-sm">
            {recurringAll.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}{r.paused && <span className="text-muted"> (paused)</span>}</span><span className="num">{peso(r.amount)}/mo</span></li>)}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Normal living cost by month</h2>
        <p className="mb-3 text-xs text-muted">Hatched = move-in / setup on top of the normal month.</p>
        <Bars ariaLabel="Normal living cost by month" data={summaries.map((s) => ({ label: fmtMonthShort(s.month), hint: fmtMonth(s.month), value: s.normalized, sub: s.setupTotal }))} />
      </section>

      <section className="card overflow-x-auto p-2 sm:p-4">
        <h2 className="mb-2 px-2 font-semibold">Monthly category totals</h2>
        <table className="ledger">
          <thead>
            <tr><th>Category</th>{months.map((m) => <th key={m} className="r">{fmtMonthShort(m)}</th>)}</tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap"><span className="flex items-center gap-2"><span className="dot" style={{ background: c.color }} />{c.name}</span></td>
                {summaries.map((s) => {
                  const v = s.byCategory.find((b) => b.category.id === c.id)?.total ?? 0;
                  return <td key={s.month} className="r num">{v ? peso(v) : <span className="text-muted">—</span>}</td>;
                })}
              </tr>
            ))}
            <tr className="bg-card-2 font-semibold"><td>Normal living cost</td>{summaries.map((s) => <td key={s.month} className="r num">{peso(s.normalized)}</td>)}</tr>
            <tr className="text-setup"><td>Move-in / setup</td>{summaries.map((s) => <td key={s.month} className="r num">{s.setupTotal ? peso(s.setupTotal) : "—"}</td>)}</tr>
            <tr className="bg-card-2 font-semibold"><td>Total actual</td>{summaries.map((s) => <td key={s.month} className="r num">{peso(s.total)}</td>)}</tr>
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto p-2 sm:p-4">
        <h2 className="mb-2 px-2 font-semibold">Utility history</h2>
        {utilityBills.length === 0 ? <p className="px-2 text-sm text-muted">No electricity or water bills recorded yet.</p> : (
          <table className="ledger">
            <thead><tr><th>Utility</th><th>Month</th><th className="r">Amount</th><th className="r">Consumption</th><th>Due</th><th>Paid</th></tr></thead>
            <tbody>
              {utilityBills.map((b) => (
                <tr key={b.id}>
                  <td><span className="flex items-center gap-2"><span className="dot" style={{ background: b.category.color }} />{b.category.name}</span></td>
                  <td>{fmtMonth(b.billingMonth)}</td>
                  <td className="r"><Money value={b.amount} /></td>
                  <td className="r num">{b.consumption != null ? `${b.consumption} ${b.category.utilityUnit ?? ""}` : "—"}</td>
                  <td className="text-muted">{b.dueDate ? fmtDate(b.dueDate) : "—"}</td>
                  <td><span className={`status status-${b.status}`}>{b.status === "paid" ? fmtDate(b.paidDate!) : b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto p-2 sm:p-4">
        <h2 className="mb-2 px-2 font-semibold">Move-in / setup purchases</h2>
        <table className="ledger">
          <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {setupRows.map((t) => (
              <tr key={t.id}><td className="whitespace-nowrap">{fmtDate(t.date)}</td><td>{t.category.name}</td><td className="pre max-w-md text-sm">{t.note}</td><td className="r"><Money value={t.amount} /></td></tr>
            ))}
            <tr className="bg-card-2 font-semibold"><td colSpan={3}>Total</td><td className="r"><Money value={setup.total} /></td></tr>
          </tbody>
        </table>
      </section>

      <RestorePanel />
    </div>
  );
}
