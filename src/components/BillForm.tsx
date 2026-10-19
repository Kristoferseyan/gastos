"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db/schema";
import type { Bill } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";
import { fromCentavos } from "@/lib/money";

type Values = { name: string; categoryId: number; billingMonth: string; amount: string; dueDate: string; paidDate: string; notes: string; consumption: string };

export function BillForm({
  categories,
  initial,
  defaults,
  onSubmit,
  onDone,
  lockCategory = false,
}: {
  categories: Category[];
  initial?: Bill;
  defaults?: Partial<Values>;
  onSubmit: (v: Values) => Promise<ActionResult<unknown>>;
  onDone: () => void;
  lockCategory?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<ActionResult<never> | null>(null);
  const [v, setV] = useState<Values>({
    name: initial?.name ?? defaults?.name ?? "",
    categoryId: initial?.categoryId ?? defaults?.categoryId ?? categories[0]?.id ?? 0,
    billingMonth: initial?.billingMonth ?? defaults?.billingMonth ?? "",
    amount: initial ? fromCentavos(initial.amount) : defaults?.amount ?? "",
    dueDate: initial?.dueDate ?? defaults?.dueDate ?? "",
    paidDate: initial?.paidDate ?? defaults?.paidDate ?? "",
    notes: initial?.notes ?? defaults?.notes ?? "",
    consumption: initial?.consumption != null ? String(initial.consumption) : defaults?.consumption ?? "",
  });
  const cat = categories.find((c) => c.id === Number(v.categoryId));
  const fe = err && !err.ok ? err.fieldErrors ?? {} : {};

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await onSubmit(v);
      if (!r.ok) {
        setErr(r);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="b-name">Bill name</label>
          <input id="b-name" className="field mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Electricity" />
          {fe.name && <p className="mt-1 text-sm text-bad">{fe.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="b-cat">Category</label>
          <select id="b-cat" className="field mt-1" value={v.categoryId} disabled={lockCategory} onChange={(e) => setV({ ...v, categoryId: Number(e.target.value) })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="b-month">Billing month</label>
          <input id="b-month" type="month" className="field mt-1" value={v.billingMonth} onChange={(e) => setV({ ...v, billingMonth: e.target.value })} />
          {fe.billingMonth && <p className="mt-1 text-sm text-bad">{fe.billingMonth}</p>}
        </div>
        <div>
          <label className="label" htmlFor="b-amount">Amount</label>
          <div className="relative mt-1">
            <span className="num absolute left-3 top-1/2 -translate-y-1/2 text-muted">₱</span>
            <input id="b-amount" inputMode="decimal" className="field num pl-7" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0.00" />
          </div>
          {fe.amount && <p className="mt-1 text-sm text-bad">{fe.amount}</p>}
        </div>
        {cat?.utilityUnit && (
          <div>
            <label className="label" htmlFor="b-cons">Consumption ({cat.utilityUnit})</label>
            <input id="b-cons" inputMode="decimal" className="field num mt-1" value={v.consumption} onChange={(e) => setV({ ...v, consumption: e.target.value })} placeholder="optional" />
            {fe.consumption && <p className="mt-1 text-sm text-bad">{fe.consumption}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="b-due">Due date</label>
          <input id="b-due" type="date" className="field mt-1" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="b-paid">Paid date</label>
          <input id="b-paid" type="date" className="field mt-1" value={v.paidDate} onChange={(e) => setV({ ...v, paidDate: e.target.value })} />
          <p className="mt-1 text-xs text-muted">Setting a paid date records the payment as an expense.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="b-notes">Notes</label>
          <textarea id="b-notes" className="field mt-1" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </div>
      </div>
      {err && !err.ok && !Object.keys(fe).length && <p className="text-sm text-bad">{err.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "Add bill"}</button>
      </div>
    </form>
  );
}
