import { listBills, listCategories, listRecurring } from "@/lib/queries";
import { ensureRecurringBills } from "@/lib/recurring";
import { currentMonth, fmtDate, fmtMonth } from "@/lib/dates";
import { peso } from "@/lib/money";
import { Money } from "@/components/Money";
import { MonthPicker } from "@/components/MonthPicker";
import { BillActions } from "@/components/BillActions";
import { AddBillButton } from "@/components/AddBillButton";

export const dynamic = "force-dynamic";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  ensureRecurringBills([month]);
  const rows = listBills({ month });
  const categories = listCategories();
  const recurring = listRecurring();
  const paid = rows.filter((b) => b.status === "paid");
  const due = rows.filter((b) => b.status !== "paid");
  const upcoming = listBills().filter((b) => b.billingMonth > month && b.status !== "paid").slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bills</h1>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} />
          <AddBillButton categories={categories} month={month} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-3 sm:p-4"><div className="label">Total</div><div className="mt-1 text-sm font-semibold sm:text-xl"><Money value={rows.reduce((s, b) => s + b.amount, 0)} /></div></div>
        <div className="card p-3 sm:p-4"><div className="label">Paid</div><div className="mt-1 text-sm font-semibold text-good sm:text-xl"><Money value={paid.reduce((s, b) => s + b.amount, 0)} /></div></div>
        <div className="card p-3 sm:p-4"><div className="label">Unpaid</div><div className="mt-1 text-sm font-semibold text-warn sm:text-xl"><Money value={due.reduce((s, b) => s + b.amount, 0)} /></div></div>
      </div>

      <section className="card overflow-x-auto p-2 sm:p-4">
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-muted">No bills for {fmtMonth(month)}. Recurring expenses generate their bills automatically; add utility bills as they arrive.</p>
        ) : (
          <>
          <ul className="divide-y divide-line sm:hidden">
            {rows.map((b) => (
              <li key={b.id} className="space-y-2 px-2 py-3">
                <div className="flex items-start gap-2">
                  <span className="dot mt-1.5" style={{ background: b.category.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted">{b.dueDate ? `Due ${fmtDate(b.dueDate)}` : "No due date"}{b.consumption != null && <> · <span className="num">{b.consumption} {b.category.utilityUnit}</span></>}{b.notes && <> · {b.notes}</>}</div>
                  </div>
                  <Money value={b.amount} className="font-semibold" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pl-5">
                  <span className={`status status-${b.status}`}>{b.status === "paid" ? `Paid ${b.paidDate ? fmtDate(b.paidDate) : ""}` : b.status === "overdue" ? "Overdue" : "Unpaid"}</span>
                  <BillActions bill={b} categories={categories} />
                </div>
              </li>
            ))}
          </ul>
          <table className="ledger hidden sm:table">
            <thead>
              <tr><th>Bill</th><th>Due</th><th>Status</th><th className="r">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="flex items-center gap-2"><span className="dot" style={{ background: b.category.color }} /><span className="font-medium">{b.name}</span></div>
                    {(b.consumption != null || b.notes) && <div className="mt-0.5 text-xs text-muted">{b.consumption != null && <span className="num">{b.consumption} {b.category.utilityUnit}</span>}{b.consumption != null && b.notes ? " · " : ""}{b.notes}</div>}
                  </td>
                  <td className="whitespace-nowrap text-muted">{b.dueDate ? fmtDate(b.dueDate) : "—"}</td>
                  <td>
                    <span className={`status status-${b.status}`}>{b.status === "paid" ? `Paid ${b.paidDate ? fmtDate(b.paidDate) : ""}` : b.status === "overdue" ? "Overdue" : "Unpaid"}</span>
                  </td>
                  <td className="r"><Money value={b.amount} className="font-semibold" /></td>
                  <td className="r"><BillActions bill={b} categories={categories} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? <p className="text-sm text-muted">Nothing generated beyond this month yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2"><span>{b.name} <span className="text-muted">· {fmtMonth(b.billingMonth)}</span></span><span className="num">{peso(b.amount)}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Recurring expenses</h2>
          <ul className="divide-y divide-line text-sm">
            {recurring.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>{r.name} <span className="text-muted">· day {r.dueDay}{r.paused ? " · paused" : ""}</span></span>
                <span className="num">{peso(r.amount)}/mo</span>
              </li>
            ))}
          </ul>
          <a href="/settings#recurring" className="mt-3 inline-block text-sm text-accent">Manage recurring expenses</a>
        </section>
      </div>
    </div>
  );
}
