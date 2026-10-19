import Link from "next/link";
import { distinctPaymentMethods, listCategories, listTransactions } from "@/lib/queries";
import { currentMonth, todayManila } from "@/lib/dates";
import { TX_TYPES, type TxType } from "@/lib/db/schema";
import { TxList } from "@/components/TxList";
import { MonthPicker } from "@/components/MonthPicker";
import { Money } from "@/components/Money";
import { TxFilters } from "./TxFilters";

export const dynamic = "force-dynamic";

type SP = { month?: string; category?: string; type?: string; q?: string; all?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const month = sp.month === "all" ? undefined : sp.month || currentMonth();
  const categoryId = Number(sp.category) || undefined;
  const type = TX_TYPES.includes(sp.type as TxType) ? (sp.type as TxType) : undefined;
  const q = sp.q?.trim() || undefined;
  const rows = listTransactions({ month, categoryId, type, q });
  const categories = listCategories(true);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const exportQs = new URLSearchParams();
  if (month) exportQs.set("month", month);
  if (type) exportQs.set("type", type);
  if (categoryId) exportQs.set("category", String(categoryId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <MonthPicker month={month ?? currentMonth()} all />
      </div>
      <TxFilters categories={categories.filter((c) => !c.archived)} categoryId={categoryId} type={type} q={q ?? ""} />
      <div className="card p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between text-sm text-muted">
          <span>{rows.length} entr{rows.length === 1 ? "y" : "ies"}{month ? "" : " · all time"}</span>
          <span className="flex items-center gap-3">
            <Money value={total} className="font-semibold text-ink" />
            <Link href={`/api/export/csv?${exportQs}`} className="text-accent">CSV</Link>
          </span>
        </div>
        <TxList rows={rows} categories={categories} methods={distinctPaymentMethods()} today={todayManila()} />
      </div>
    </div>
  );
}
