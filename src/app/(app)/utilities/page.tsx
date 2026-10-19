import { listCategories, utilityHistory } from "@/lib/queries";
import { currentMonth, fmtDate, fmtMonth, fmtMonthShort } from "@/lib/dates";
import { peso } from "@/lib/money";
import { Money } from "@/components/Money";
import { Lines } from "@/components/charts/Lines";
import { AddBillButton } from "@/components/AddBillButton";
import { BillActions } from "@/components/BillActions";

export const dynamic = "force-dynamic";

export default function UtilitiesPage() {
  const utilities = listCategories().filter((c) => c.group === "utilities");
  const allCats = listCategories();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Utilities</h1>
        <p className="text-sm text-muted">Add each billing cycle as the bill arrives. Nothing here is assumed.</p>
      </div>
      {utilities.map((u) => {
        const history = utilityHistory(u.id);
        const paid = history.filter((b) => b.paidDate);
        const avg = history.length ? Math.round(history.reduce((s, b) => s + b.amount, 0) / history.length) : 0;
        const last = history[history.length - 1];
        return (
          <section key={u.id} className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="dot" style={{ background: u.color }} />{u.name}</h2>
              <AddBillButton categories={allCats} category={u} month={currentMonth()} label={`+ Add ${u.name.toLowerCase()} bill`} primary />
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted">No {u.name.toLowerCase()} bill recorded yet. Add the first one when it arrives.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
                  <div><div className="label">Latest</div><div className="num mt-1 font-semibold">{peso(last.amount)}</div><div className="text-xs text-muted">{fmtMonth(last.billingMonth)}</div></div>
                  <div><div className="label">Average</div><div className="num mt-1 font-semibold">{peso(avg)}</div><div className="text-xs text-muted">{history.length} bill{history.length === 1 ? "" : "s"}</div></div>
                  <div><div className="label">Paid</div><div className="num mt-1 font-semibold">{paid.length}/{history.length}</div></div>
                </div>
                {history.length < 2 ? (
                  <p className="text-sm text-muted">The chart appears once a second bill is recorded.</p>
                ) : (
                <div className={`grid gap-4 ${history.some((b) => b.consumption != null) ? "md:grid-cols-2" : ""}`}>
                  <div>
                    <div className="label mb-1">Amount</div>
                    <Lines ariaLabel={`${u.name} bill amount history`} color={u.color} data={history.map((b) => ({ label: fmtMonthShort(b.billingMonth), hint: fmtMonth(b.billingMonth), value: b.amount }))} />
                  </div>
                  {history.some((b) => b.consumption != null) && (
                    <div>
                      <div className="label mb-1">Consumption ({u.utilityUnit})</div>
                      <Lines ariaLabel={`${u.name} consumption history`} color={u.color} unit={u.utilityUnit ?? ""} data={history.filter((b) => b.consumption != null).map((b) => ({ label: fmtMonthShort(b.billingMonth), hint: fmtMonth(b.billingMonth), value: b.consumption! }))} />
                    </div>
                  )}
                </div>
                )}
                <ul className="mt-4 divide-y divide-line sm:hidden">
                  {[...history].reverse().map((b) => (
                    <li key={b.id} className="space-y-2 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{fmtMonth(b.billingMonth)}</div>
                          <div className="text-xs text-muted">{b.consumption != null && <><span className="num">{b.consumption} {u.utilityUnit}</span> · </>}{b.dueDate ? `Due ${fmtDate(b.dueDate)}` : "No due date"}{b.notes && <> · {b.notes}</>}</div>
                        </div>
                        <Money value={b.amount} className="font-semibold" />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`status status-${b.status}`}>{b.status === "paid" ? `Paid ${fmtDate(b.paidDate!)}` : b.status === "overdue" ? "Overdue" : "Unpaid"}</span>
                        <BillActions bill={b} categories={allCats} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 hidden overflow-x-auto sm:block">
                  <table className="ledger">
                    <thead><tr><th>Month</th><th className="r">Amount</th><th className="r">{u.utilityUnit}</th><th>Due</th><th>Paid</th><th></th></tr></thead>
                    <tbody>
                      {[...history].reverse().map((b) => (
                        <tr key={b.id}>
                          <td>{fmtMonth(b.billingMonth)}{b.notes && <div className="text-xs text-muted">{b.notes}</div>}</td>
                          <td className="r"><Money value={b.amount} /></td>
                          <td className="r num">{b.consumption ?? "—"}</td>
                          <td className="whitespace-nowrap text-muted">{b.dueDate ? fmtDate(b.dueDate) : "—"}</td>
                          <td className="whitespace-nowrap"><span className={`status status-${b.status}`}>{b.status === "paid" ? fmtDate(b.paidDate!) : b.status === "overdue" ? "Overdue" : "Unpaid"}</span></td>
                          <td className="r"><BillActions bill={b} categories={allCats} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
