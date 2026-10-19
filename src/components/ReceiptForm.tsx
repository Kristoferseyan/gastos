"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, TxType } from "@/lib/db/schema";
import type { DraftItem } from "@/lib/ai";
import { createTransactions, parseReceipt } from "@/actions/ai";
import { fromCentavos, peso, toCentavos } from "@/lib/money";
import { defaultType } from "./TransactionForm";

type Row = { key: number; name: string; amount: string; categoryId: number; date: string; paymentMethod: string; confidence: number };

const EXAMPLE = `eggs 1 tray 240
jasmine rice 5kg 310
joy dishwashing 89
tricycle pamasahe 30
jollibee lunch 149 gcash`;

let seq = 0;

export function ReceiptForm({ categories, today, methods = [], onDone }: { categories: Category[]; today: string; methods?: string[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("");
  const methodChips = useMemo(() => Array.from(new Set(["Cash", ...methods])), [methods]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [combine, setCombine] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState(0);
  const active = useMemo(() => categories.filter((c) => !c.archived), [categories]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  function toRow(d: DraftItem): Row {
    return { key: seq++, name: d.name, amount: fromCentavos(d.amount), categoryId: d.categoryId, date: d.date ?? date, paymentMethod: d.paymentMethod ?? method, confidence: d.confidence };
  }

  function parse() {
    setErr(null);
    start(async () => {
      const res = await parseReceipt(text);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setRows(res.data!.items.map(toRow));
      setMs(res.data!.ms);
    });
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const total = useMemo(() => (rows ?? []).reduce((s, r) => s + (toCentavos(r.amount) ?? 0), 0), [rows]);
  const typeFor = (categoryId: number): TxType => (setup ? "setup" : defaultType(catById.get(categoryId)));

  function payloads() {
    const list = rows!.map((r) => ({ date: r.date, amount: r.amount, categoryId: r.categoryId, note: r.name.trim(), type: typeFor(r.categoryId), paymentMethod: r.paymentMethod.trim() || null, tags: "" }));
    if (!combine) return list;
    const merged = new Map<string, (typeof list)[number] & { cents: number; names: string[] }>();
    for (const p of list) {
      const k = `${p.categoryId}|${p.date}|${p.paymentMethod ?? ""}`;
      const cents = toCentavos(p.amount) ?? 0;
      const m = merged.get(k);
      if (m) {
        m.cents += cents;
        m.names.push(p.note);
      } else merged.set(k, { ...p, cents, names: [p.note] });
    }
    return [...merged.values()].map(({ cents, names, ...p }) => ({ ...p, amount: fromCentavos(cents), note: names.join(", ") }));
  }

  function save() {
    setErr(null);
    start(async () => {
      const res = await createTransactions(payloads());
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Type or paste the items, one per line or comma-separated, with the peso amount. The AI splits and categorizes them; you check the result before anything is saved.</p>
        <textarea className="field font-mono text-sm" rows={8} placeholder={EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label className="label" htmlFor="rc-date">Date (unless the text says otherwise)</label>
            <input id="rc-date" type="date" className="field mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="label">Paid with (unless the text says otherwise)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {methodChips.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={method.toLowerCase() === m.toLowerCase()} onClick={() => setMethod(method.toLowerCase() === m.toLowerCase() ? "" : m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !text.trim()} onClick={parse}>
            {pending ? "Reading… about 15s" : "Read with AI"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{rows.length} item{rows.length === 1 ? "" : "s"} found in {(ms / 1000).toFixed(1)}s. Fix anything that looks off.</span>
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => setRows(null)}>← Edit text</button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-line p-2">
            <div className="flex items-center gap-2">
              <input className="field min-w-0 flex-1" value={r.name} placeholder="Item" onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Item name" />
              <div className="flex w-28 items-center gap-1 border-b-2 border-line-strong focus-within:border-accent">
                <span className="num text-muted">₱</span>
                <input className="num w-full bg-transparent py-1 text-right outline-none" inputMode="decimal" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} aria-label="Amount" />
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => rs!.filter((x) => x.key !== r.key))} aria-label="Remove item">✕</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="dot" style={{ background: catById.get(r.categoryId)?.color }} />
              <select className="field min-w-0 flex-1 py-1" value={r.categoryId} onChange={(e) => update(r.key, { categoryId: Number(e.target.value) })} aria-label="Category">
                {active.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {r.confidence < 0.7 && <span className="status status-unpaid" title="The AI was unsure about this category">check</span>}
              <input type="date" className="field w-auto py-1" value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} aria-label="Date" />
            </div>
          </div>
        ))}
      </div>
      {rows.some((r) => catById.get(r.categoryId)?.group === "utilities") && !setup && (
        <p className="text-xs text-muted">Utility payments saved here count in the month but do not appear in the Utilities history. For an electricity or water bill, use the Utilities page instead.</p>
      )}
      <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setRows((rs) => [...rs!, toRow({ name: "", amount: 0, categoryId: active[0]?.id ?? 0, date, paymentMethod: null, confidence: 1 })])}>
        + Add a missed item
      </button>
      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={setup} onChange={(e) => setSetup(e.target.checked)} /> These are move-in / setup purchases</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} /> Combine into one entry per category</label>
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="num font-semibold">{peso(total)}</span>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !rows.length} onClick={save}>
            {pending ? "Saving…" : `Save ${combine ? payloads().length : rows.length} entr${(combine ? payloads().length : rows.length) === 1 ? "y" : "ies"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
