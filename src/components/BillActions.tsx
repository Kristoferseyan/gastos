"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBill, markBillPaid, markBillUnpaid, updateBill } from "@/actions/bills";
import type { BillRow } from "@/lib/queries";
import type { Category } from "@/lib/db/schema";
import { Dialog } from "./Dialog";
import { BillForm } from "./BillForm";

export function BillActions({ bill, categories, compact = false }: { bill: BillRow; categories?: Category[]; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Something went wrong");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {bill.status === "paid" ? (
        !compact && (
          <button className="btn btn-sm" disabled={pending} onClick={() => run(() => markBillUnpaid(bill.id))} title="Removes the payment entry too">
            Undo paid
          </button>
        )
      ) : (
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => markBillPaid(bill.id))}>
          {pending ? "…" : "Mark paid"}
        </button>
      )}
      {!compact && categories && (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>Edit</button>
          <button
            className="btn btn-ghost btn-sm text-bad"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${bill.name}"?${bill.transactionId ? "\n\nIts payment entry will be kept as a normal transaction." : ""}`)) run(() => deleteBill(bill.id));
            }}
          >
            Delete
          </button>
          <Dialog open={edit} onClose={() => setEdit(false)} title="Edit bill">
            <BillForm categories={categories} initial={bill} onSubmit={(v) => updateBill(bill.id, v)} onDone={() => setEdit(false)} />
          </Dialog>
        </>
      )}
      {msg && <span className="text-xs text-bad">{msg}</span>}
    </div>
  );
}
