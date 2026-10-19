"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TxRow } from "@/lib/queries";
import type { Category } from "@/lib/db/schema";
import { peso } from "@/lib/money";
import { fmtDateShort, fmtDate } from "@/lib/dates";
import { Dialog } from "./Dialog";
import { TransactionForm } from "./TransactionForm";
import { deleteTransaction } from "@/actions/transactions";

const TYPE_LABEL = { variable: "variable", recurring: "recurring", setup: "move-in" } as const;

export function TxList({ rows, categories, methods, today, compact = false }: { rows: TxRow[]; categories: Category[]; methods: string[]; today: string; compact?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (!rows.length) return <p className="text-sm text-muted">No entries match. Add one with the + button.</p>;

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((t) => {
          const open = expanded === t.id;
          const firstLine = t.note.split("\n")[0];
          const multi = t.note.includes("\n") || t.note.length > 80;
          return (
            <li key={t.id} className="py-2.5">
              <div className="flex items-start gap-3">
                <span className="dot mt-1.5" style={{ background: t.category.color }} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded(open ? null : t.id)}>
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{firstLine || t.category.name}</span>
                    {multi && !open && <span className="text-xs text-muted">…</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span>{compact ? fmtDateShort(t.date) : fmtDate(t.date)}</span>
                    <span>·</span>
                    <span>{t.category.name}</span>
                    <span className={`type-pill ${t.type === "setup" ? "type-setup" : ""}`}>{TYPE_LABEL[t.type]}</span>
                    {t.paymentMethod && <span>· {t.paymentMethod}</span>}
                    {t.tags && !compact && <span>· {t.tags}</span>}
                  </div>
                </button>
                <span className={`num font-semibold ${t.type === "setup" ? "text-setup" : ""}`}>{peso(t.amount)}</span>
              </div>
              {open && (
                <div className="ml-[22px] mt-2 space-y-2">
                  {t.note && <p className="pre text-sm text-ink-2">{t.note}</p>}
                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => setEditing(t)}>Edit</button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete this ${peso(t.amount)} entry?${t.billId ? "\n\nThe linked bill goes back to unpaid." : ""}`))
                          start(async () => {
                            await deleteTransaction(t.id);
                            router.refresh();
                          });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edit entry">
        {editing && (
          <TransactionForm
            categories={categories}
            today={today}
            methods={methods}
            initial={{ id: editing.id, date: editing.date, amountCentavos: editing.amount, categoryId: editing.categoryId, note: editing.note, type: editing.type, paymentMethod: editing.paymentMethod ?? "", tags: editing.tags }}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
