"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, TxType } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";
import { createTransaction, updateTransaction } from "@/actions/transactions";
import { fromCentavos } from "@/lib/money";

export type TxFormValues = {
  id?: number;
  date: string;
  amount: string;
  categoryId: number | null;
  note: string;
  type: TxType;
  paymentMethod: string;
  tags: string;
};

const TYPE_LABEL: Record<TxType, string> = { variable: "Variable", recurring: "Recurring", setup: "Move-in / setup" };

export function defaultType(cat: Category | undefined): TxType {
  if (!cat) return "variable";
  if (cat.group === "rent" || cat.group === "utilities") return "recurring";
  if (/setup|furniture|move/i.test(cat.name)) return "setup";
  return "variable";
}

export function TransactionForm({
  categories,
  today,
  initial,
  methods = [],
  onDone,
}: {
  categories: Category[];
  today: string;
  initial?: Partial<TxFormValues> & { id?: number; amountCentavos?: number };
  methods?: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<TxFormValues>({
    id: initial?.id,
    date: initial?.date ?? today,
    amount: initial?.amountCentavos != null ? fromCentavos(initial.amountCentavos) : initial?.amount ?? "",
    categoryId: initial?.categoryId ?? null,
    note: initial?.note ?? "",
    type: initial?.type ?? "variable",
    paymentMethod: initial?.paymentMethod ?? "",
    tags: initial?.tags ?? "",
  });
  const [typeTouched, setTypeTouched] = useState(Boolean(initial?.id));
  const [more, setMore] = useState(Boolean(initial?.tags));
  const methodChips = useMemo(() => Array.from(new Set(["Cash", ...methods])), [methods]);
  const [err, setErr] = useState<ActionResult<never> | null>(null);
  const active = useMemo(() => categories.filter((c) => !c.archived || c.id === v.categoryId), [categories, v.categoryId]);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  function pick(c: Category) {
    setV((s) => ({ ...s, categoryId: c.id, type: typeTouched ? s.type : defaultType(c) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload = { ...v, paymentMethod: v.paymentMethod.trim() || null };
    start(async () => {
      const res = v.id ? await updateTransaction(v.id, payload) : await createTransaction(payload);
      if (!res.ok) {
        setErr(res);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  const fe = err && !err.ok ? err.fieldErrors ?? {} : {};

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="amount">Amount</label>
        <div className="mt-1 flex items-baseline gap-2 border-b-2 border-line-strong focus-within:border-accent">
          <span className="num text-3xl text-muted">₱</span>
          <input
            ref={amountRef}
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            className="num w-full bg-transparent py-1 text-4xl font-semibold outline-none"
            value={v.amount}
            onChange={(e) => setV({ ...v, amount: e.target.value })}
          />
        </div>
        {fe.amount && <p className="mt-1 text-sm text-bad">{fe.amount}</p>}
      </div>

      <div>
        <div className="label">Category</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {active.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={v.categoryId === c.id} onClick={() => pick(c)}>
              <span className="dot" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        {fe.categoryId && <p className="mt-1 text-sm text-bad">{fe.categoryId}</p>}
      </div>

      <div>
        <label className="label" htmlFor="note">Note</label>
        <textarea id="note" className="field mt-1" rows={2} placeholder="What was it?" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label">Type</div>
          <div className="seg mt-1" role="group" aria-label="Type">
            {(Object.keys(TYPE_LABEL) as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={v.type === t}
                onClick={() => {
                  setTypeTouched(true);
                  setV({ ...v, type: t });
                }}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="field mt-1" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          {fe.date && <p className="mt-1 text-sm text-bad">{fe.date}</p>}
        </div>
      </div>
      {v.type === "setup" && <p className="text-xs text-setup">Move-in purchases count toward actual spending but stay out of the normal monthly living cost.</p>}

      <div>
        <label className="label" htmlFor="method">Payment method</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {methodChips.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={v.paymentMethod.trim().toLowerCase() === m.toLowerCase()} onClick={() => setV({ ...v, paymentMethod: v.paymentMethod.trim().toLowerCase() === m.toLowerCase() ? "" : m })}>
              {m}
            </button>
          ))}
        </div>
        <input id="method" className="field mt-2" placeholder="or type one: GCash, debit card, credit card…" value={v.paymentMethod} onChange={(e) => setV({ ...v, paymentMethod: e.target.value })} />
        <p className="mt-1 text-xs text-muted">Log the purchase when it happens, with the card it went on. Paying the card bill later is not an expense.</p>
      </div>

      {more ? (
        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input id="tags" className="field mt-1" placeholder="comma, separated" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
        </div>
      ) : (
        <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setMore(true)}>
          + Tags
        </button>
      )}

      {err && !err.ok && !Object.keys(fe).length && <p className="text-sm text-bad">{err.error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : v.id ? "Save changes" : "Save"}
        </button>
      </div>
    </form>
  );
}
