"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Income } from "@/lib/db/schema";
import { createIncome, deleteIncome, setIncomeEnabled } from "@/actions/settings";
import { peso } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export function IncomeManager({ enabled, rows, today }: { enabled: boolean; rows: Income[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ date: today, amount: "", source: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => start(async () => { await setIncomeEnabled(e.target.checked); router.refresh(); })} />
        Track income (adds an income line and “left over” to the monthly view)
      </label>
      {enabled && (
        <>
          <form
            className="grid gap-2 sm:grid-cols-[10rem_9rem_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              start(async () => {
                const r = await createIncome(v);
                if (!r.ok) return setErr(r.error);
                setV({ ...v, amount: "", note: "" });
                router.refresh();
              });
            }}
          >
            <input type="date" className="field" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} aria-label="Date" />
            <input inputMode="decimal" className="field num" placeholder="Amount" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} aria-label="Amount" />
            <input className="field" placeholder="Source (salary, freelance…)" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} aria-label="Source" />
            <input className="field" placeholder="Note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} aria-label="Note" />
            <button className="btn btn-primary" disabled={pending}>Add</button>
          </form>
          {err && <p className="text-sm text-bad">{err}</p>}
          {rows.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className="text-muted">{fmtDate(r.date)}</span>
                  <span className="flex-1 truncate">{r.source || "Income"}{r.note ? ` · ${r.note}` : ""}</span>
                  <span className="num font-medium text-good">{peso(r.amount)}</span>
                  <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={() => { if (confirm("Delete this income entry?")) start(async () => { await deleteIncome(r.id); router.refresh(); }); }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
