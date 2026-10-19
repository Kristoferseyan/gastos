"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Recurring } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";
import { createRecurring, deleteRecurring, setRecurringPaused, updateRecurring } from "@/actions/recurring";
import { fromCentavos, peso } from "@/lib/money";
import { duePhrase } from "@/lib/dates";
import { Dialog } from "../Dialog";

type Row = Recurring & { category: Category };
type Values = { name: string; categoryId: number; amount: string; dueDay: number; dueDaysBefore: number; startMonth: string; endMonth: string; notes: string };

function Form({ categories, initial, currentMonth, onSubmit, onDone }: { categories: Category[]; initial?: Recurring; currentMonth: string; onSubmit: (v: Values) => Promise<ActionResult<unknown>>; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<ActionResult<never> | null>(null);
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    categoryId: initial?.categoryId ?? categories[0]?.id ?? 0,
    amount: initial ? fromCentavos(initial.amount) : "",
    dueDay: initial?.dueDay ?? 1,
    dueDaysBefore: initial?.dueDaysBefore ?? 0,
    startMonth: initial?.startMonth ?? currentMonth,
    endMonth: initial?.endMonth ?? "",
    notes: initial?.notes ?? "",
  });
  const fe = err && !err.ok ? err.fieldErrors ?? {} : {};
  const before = v.dueDaysBefore > 0;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const r = await onSubmit(v);
          if (!r.ok) return setErr(r);
          router.refresh();
          onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Name</label><input className="field mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Rent" />{fe.name && <p className="text-sm text-bad">{fe.name}</p>}</div>
        <div><label className="label">Category</label><select className="field mt-1" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: Number(e.target.value) })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Amount per month</label><input inputMode="decimal" className="field num mt-1" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />{fe.amount && <p className="text-sm text-bad">{fe.amount}</p>}</div>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Due</label><select className="field mt-1" value={before ? "before" : "day"} onChange={(e) => setV({ ...v, dueDaysBefore: e.target.value === "before" ? Math.max(1, v.dueDaysBefore) : 0 })}><option value="day">On a day of the billing month</option><option value="before">Days before the billing month starts</option></select></div>
          {before ? (
            <div><label className="label">Days before the 1st</label><input type="number" min={1} max={31} className="field num mt-1" value={v.dueDaysBefore} onChange={(e) => setV({ ...v, dueDaysBefore: Number(e.target.value) })} /><p className="mt-1 text-xs text-muted">e.g. 7 = rent for October is due Sep 24</p></div>
          ) : (
            <div><label className="label">Due day of month</label><input type="number" min={1} max={31} className="field num mt-1" value={v.dueDay} onChange={(e) => setV({ ...v, dueDay: Number(e.target.value) })} /></div>
          )}
        </div>
        <div><label className="label">Starts</label><input type="month" className="field mt-1" value={v.startMonth} onChange={(e) => setV({ ...v, startMonth: e.target.value })} />{fe.startMonth && <p className="text-sm text-bad">{fe.startMonth}</p>}</div>
        <div><label className="label">Ends (optional)</label><input type="month" className="field mt-1" value={v.endMonth} onChange={(e) => setV({ ...v, endMonth: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Notes</label><input className="field mt-1" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
      </div>
      {err && !err.ok && !Object.keys(fe).length && <p className="text-sm text-bad">{err.error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onDone}>Cancel</button><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export function RecurringManager({ rows, categories, currentMonth }: { rows: Row[]; categories: Category[]; currentMonth: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="dot" style={{ background: r.category.color }} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.name} {r.paused && <span className="status status-unpaid ml-1">Paused</span>}</div>
              <div className="text-xs text-muted">{r.category.name} · due {duePhrase(r.dueDay, r.dueDaysBefore)} · from {r.startMonth}{r.endMonth ? ` to ${r.endMonth}` : ""}{r.notes ? ` · ${r.notes}` : ""}</div>
            </div>
            <span className="num font-semibold">{peso(r.amount)}<span className="text-xs font-normal text-muted">/mo</span></span>
            <div className="flex basis-full justify-end gap-1 sm:basis-auto">
              <button className="btn btn-sm" disabled={pending} onClick={() => run(() => setRecurringPaused(r.id, !r.paused))}>{r.paused ? "Resume" : "Pause"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={() => { if (confirm(`Delete "${r.name}"? Unpaid bills it generated are removed; paid ones stay.`)) run(() => deleteRecurring(r.id)); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="btn btn-sm mt-3" onClick={() => setAdding(true)}>+ Add recurring expense</button>
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add recurring expense">
        <Form key={String(adding)} categories={categories} currentMonth={currentMonth} onSubmit={(v) => createRecurring(v)} onDone={() => setAdding(false)} />
      </Dialog>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edit recurring expense">
        {editing && <Form categories={categories} currentMonth={currentMonth} initial={editing} onSubmit={(v) => updateRecurring(editing.id, v)} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}
