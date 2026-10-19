"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addMonths, fmtMonth } from "@/lib/dates";

export function MonthPicker({ month, all = false }: { month: string; all?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  function go(m: string | null) {
    const p = new URLSearchParams(sp.toString());
    if (m) p.set("month", m);
    else p.delete("month");
    router.push(`${path}?${p.toString()}`);
  }
  return (
    <div className="flex items-center gap-1">
      <button className="btn btn-sm" onClick={() => go(addMonths(month, -1))} aria-label="Previous month">‹</button>
      <input type="month" className="field num h-8 w-auto min-h-0 py-0 text-sm" value={month} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Month" />
      <button className="btn btn-sm" onClick={() => go(addMonths(month, 1))} aria-label="Next month">›</button>
      <span className="ml-1 hidden text-sm text-muted sm:inline">{fmtMonth(month)}</span>
      {all && (
        <button className="btn btn-ghost btn-sm" onClick={() => go(null)}>All time</button>
      )}
    </div>
  );
}
