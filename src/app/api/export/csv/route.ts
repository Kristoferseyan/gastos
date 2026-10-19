import { listTransactions } from "@/lib/queries";
import { fromCentavos } from "@/lib/money";
import { todayManila } from "@/lib/dates";
import type { TxType } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || undefined;
  const type = (url.searchParams.get("type") || undefined) as TxType | undefined;
  const categoryId = Number(url.searchParams.get("category")) || undefined;
  const rows = listTransactions({ month, type, categoryId });
  const header = ["id", "date", "amount", "category", "group", "type", "note", "payment_method", "tags", "bill_id"];
  const lines = [header.join(",")];
  for (const t of rows) {
    lines.push(
      [t.id, t.date, fromCentavos(t.amount), t.category.name, t.category.group, t.type, t.note, t.paymentMethod ?? "", t.tags, t.billId ?? ""]
        .map(csvCell)
        .join(","),
    );
  }
  const name = `gastos-transactions${month ? `-${month}` : ""}-${todayManila()}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
