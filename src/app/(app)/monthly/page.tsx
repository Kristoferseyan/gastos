import { incomeEnabled, listBills, listIncome, monthSummary, monthsWithData } from "@/lib/queries";
import { ensureRecurringBills } from "@/lib/recurring";
import { currentMonth, fmtMonth, fmtMonthShort } from "@/lib/dates";
import { peso } from "@/lib/money";
import { Money } from "@/components/Money";
import { MonthPicker } from "@/components/MonthPicker";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  ensureRecurringBills([month]);
  const s = monthSummary(month);
  const bills = listBills({ month });
  const showIncome = incomeEnabled();
  const income = showIncome ? listIncome(month) : [];
  const months = monthsWithData();
  const rows: { label: string; value: number; tone?: string; sub?: string }[] = [
    { label: "Rent", value: s.byGroup.rent },
    { label: "Utilities", value: s.byGroup.utilities, sub: "electricity, water" },
    { label: "Groceries", value: s.byGroup.groceries },
    { label: "Household", value: s.byGroup.household },
    { label: "Miscellaneous", value: s.byGroup.other, sub: "eating out, transport, personal care, misc" },
  ];
  const personalRow = { label: "Personal subscriptions", value: s.byGroup.personal, sub: "ChatGPT, Spotify… not part of the apartment" };
  const unpaidExpected = bills.filter((b) => b.status !== "paid").reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{fmtMonth(month)}</h1>
        <MonthPicker month={month} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="card p-2 sm:p-4">
          <table className="ledger">
            <tbody>
              {showIncome && (
                <tr>
                  <td>Income<div className="text-xs text-muted">{income.length} entr{income.length === 1 ? "y" : "ies"}</div></td>
                  <td className="r text-good"><Money value={s.income} /></td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}{r.sub && <div className="text-xs text-muted">{r.sub}</div>}</td>
                  <td className="r"><Money value={r.value} className={r.value === 0 ? "text-muted" : ""} /></td>
                </tr>
              ))}
              <tr className="bg-card-2">
                <td className="font-semibold">Apartment living cost<div className="text-xs font-normal text-muted">the lines above, excluding move-in / setup</div></td>
                <td className="r"><Money value={s.apartment} className="text-lg font-semibold" /></td>
              </tr>
              <tr>
                <td>{personalRow.label}<div className="text-xs text-muted">{personalRow.sub}</div></td>
                <td className="r"><Money value={personalRow.value} className={personalRow.value === 0 ? "text-muted" : ""} /></td>
              </tr>
              <tr className="bg-card-2">
                <td className="font-semibold">Normal monthly cost<div className="text-xs font-normal text-muted">apartment + personal, excluding move-in / setup</div></td>
                <td className="r"><Money value={s.normalized} className="text-lg font-semibold" /></td>
              </tr>
              <tr>
                <td className="text-setup">Move-in / setup purchases<div className="text-xs text-muted">one-time, do not repeat monthly</div></td>
                <td className="r"><Money value={s.setupTotal} className="text-setup" /></td>
              </tr>
              <tr className="bg-card-2">
                <td className="font-semibold">Total actual spending</td>
                <td className="r"><Money value={s.total} className="text-lg font-semibold" /></td>
              </tr>
              {showIncome && (
                <tr>
                  <td className="font-semibold">Left over</td>
                  <td className="r"><Money value={s.income - s.total} className={`font-semibold ${s.income - s.total < 0 ? "text-bad" : "text-good"}`} /></td>
                </tr>
              )}
              {unpaidExpected > 0 && (
                <tr>
                  <td className="text-muted">Bills still unpaid for this month<div className="text-xs">not yet counted above</div></td>
                  <td className="r"><Money value={unpaidExpected} className="text-warn" /></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="label mb-2">By type</div>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>Recurring</span><span className="num">{peso(s.recurringTotal)}</span></li>
              <li className="flex justify-between"><span>Variable</span><span className="num">{peso(s.variableTotal)}</span></li>
              <li className="flex justify-between text-setup"><span>Move-in / setup</span><span className="num">{peso(s.setupTotal)}</span></li>
            </ul>
          </section>
          <section className="card p-4">
            <div className="label mb-2">By category</div>
            {s.byCategory.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
              <ul className="space-y-1 text-sm">
                {s.byCategory.map(({ category, total }) => (
                  <li key={category.id} className="flex items-center gap-2"><span className="dot" style={{ background: category.color }} /><span className="flex-1 truncate">{category.name}</span><span className="num">{peso(total)}</span></li>
                ))}
              </ul>
            )}
            <Link href={`/transactions?month=${month}`} className="mt-3 inline-block text-sm text-accent">See entries</Link>
          </section>
          <section className="card p-4">
            <div className="label mb-2">Months</div>
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => (
                <Link key={m} href={`/monthly?month=${m}`} className="chip" data-active={m === month}>{fmtMonthShort(m)}</Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
