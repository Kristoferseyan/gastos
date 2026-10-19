"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db/schema";
import { CATEGORY_GROUPS, type CategoryGroup } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from "@/actions/categories";
import { fromCentavos, peso } from "@/lib/money";
import { Dialog } from "../Dialog";

const GROUP_LABEL: Record<CategoryGroup, string> = { rent: "Rent", utilities: "Utilities", groceries: "Groceries", household: "Household", other: "Miscellaneous", personal: "Personal / subscriptions" };
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948", "#8a7a5e", "#6b6a66", "#0e8f8f", "#b5651d"];

type Values = { name: string; group: CategoryGroup; color: string; budget: string; utilityUnit: string };

function Form({ initial, onSubmit, onDone }: { initial?: Category; onSubmit: (v: Values) => Promise<ActionResult<unknown>>; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<ActionResult<never> | null>(null);
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    group: initial?.group ?? "other",
    color: initial?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
    budget: initial?.budget ? fromCentavos(initial.budget) : "",
    utilityUnit: initial?.utilityUnit ?? "",
  });
  const fe = err && !err.ok ? err.fieldErrors ?? {} : {};
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const r = await onSubmit({ ...v, utilityUnit: v.group === "utilities" ? v.utilityUnit : "" });
          if (!r.ok) return setErr(r);
          router.refresh();
          onDone();
        });
      }}
    >
      <div><label className="label">Name</label><input className="field mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />{fe.name && <p className="text-sm text-bad">{fe.name}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Group (monthly view line)</label><select className="field mt-1" value={v.group} onChange={(e) => setV({ ...v, group: e.target.value as CategoryGroup })}>{CATEGORY_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</select></div>
        <div><label className="label">Monthly budget (optional)</label><input inputMode="decimal" className="field num mt-1" value={v.budget} onChange={(e) => setV({ ...v, budget: e.target.value })} placeholder="e.g. 4000" />{fe.budget && <p className="text-sm text-bad">{fe.budget}</p>}</div>
        {v.group === "utilities" && <div><label className="label">Consumption unit</label><input className="field mt-1" value={v.utilityUnit} onChange={(e) => setV({ ...v, utilityUnit: e.target.value })} placeholder="kWh, m³" /></div>}
      </div>
      <div>
        <div className="label">Color</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={v.color === c} className="h-7 w-7 rounded-md border-2 aria-pressed:border-ink" style={{ background: c, borderColor: v.color === c ? "var(--ink)" : "transparent" }} onClick={() => setV({ ...v, color: c })} />)}
          <input type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="h-7 w-9 cursor-pointer rounded-md border border-line-strong bg-transparent" aria-label="Custom color" />
        </div>
      </div>
      {err && !err.ok && !Object.keys(fe).length && <p className="text-sm text-bad">{err.error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onDone}>Cancel</button><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export function CategoryManager({ rows }: { rows: Category[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.error); router.refresh(); });
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((c) => (
          <li key={c.id} className={`flex flex-wrap items-center gap-2 py-2 ${c.archived ? "opacity-50" : ""}`}>
            <span className="dot" style={{ background: c.color }} />
            <div className="min-w-0 flex-1">
              <span className="font-medium">{c.name}</span>
              <span className="block text-xs text-muted sm:ml-2 sm:inline">{GROUP_LABEL[c.group]}{c.utilityUnit ? ` · ${c.utilityUnit}` : ""}{c.budget ? ` · budget ${peso(c.budget)}` : ""}{c.archived ? " · archived" : ""}</span>
            </div>
            <div className="flex basis-full justify-end gap-1 sm:basis-auto">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
              <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setCategoryArchived(c.id, !c.archived))}>{c.archived ? "Unarchive" : "Archive"}</button>
              <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={() => { if (confirm(`Delete "${c.name}"?`)) run(() => deleteCategory(c.id)); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
      <button className="btn btn-sm mt-3" onClick={() => setAdding(true)}>+ Add category</button>
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add category"><Form key={String(adding)} onSubmit={(v) => createCategory(v)} onDone={() => setAdding(false)} /></Dialog>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edit category">{editing && <Form initial={editing} onSubmit={(v) => updateCategory(editing.id, v)} onDone={() => setEditing(null)} />}</Dialog>
    </>
  );
}
