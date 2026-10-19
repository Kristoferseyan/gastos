"use client";
import { useState } from "react";
import type { Category } from "@/lib/db/schema";
import { createBill } from "@/actions/bills";
import { Dialog } from "./Dialog";
import { BillForm } from "./BillForm";

export function AddBillButton({ categories, month, category, label = "+ Add bill", primary = false }: { categories: Category[]; month: string; category?: Category; label?: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn btn-sm ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>{label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={category ? `Add ${category.name.toLowerCase()} bill` : "Add bill"}>
        <BillForm
          key={String(open)}
          categories={category ? [category] : categories}
          lockCategory={Boolean(category)}
          defaults={{ billingMonth: month, categoryId: category?.id, name: category?.name ?? "" }}
          onSubmit={(v) => createBill(v)}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
