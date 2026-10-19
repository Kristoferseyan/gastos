"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category, TxType } from "@/lib/db/schema";

export function TxFilters({ categories, categoryId, type, q }: { categories: Category[]; categoryId?: number; type?: TxType; q: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [search, setSearch] = useState(q);

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${path}?${p.toString()}`);
  }

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => set("q", search.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap gap-2">
      <input className="field min-w-[12rem] flex-1" type="search" placeholder="Search notes, tags, method" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select className="field w-auto" value={categoryId ?? ""} onChange={(e) => set("category", e.target.value)} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select className="field w-auto" value={type ?? ""} onChange={(e) => set("type", e.target.value)} aria-label="Type">
        <option value="">All types</option>
        <option value="variable">Variable</option>
        <option value="recurring">Recurring</option>
        <option value="setup">Move-in / setup</option>
      </select>
    </div>
  );
}
