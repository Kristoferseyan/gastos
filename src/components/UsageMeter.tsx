"use client";
import { useCallback, useEffect, useState } from "react";
import { getUsage } from "@/actions/usage";
import type { AiBalance } from "@/lib/ai";

const LOW = 1;

export function UsageMeter({ tick }: { tick: number }) {
  const [data, setData] = useState<AiBalance | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getUsage();
    if (r.ok && r.data) {
      setData(r.data);
      setErr(null);
    } else if (!r.ok) setErr(r.error);
  }, []);

  useEffect(() => {
    void load();
  }, [tick, load]);

  if (!data)
    return (
      <div className="card px-4 py-3 text-xs text-muted lg:col-span-2">
        {err ? <>AI balance unavailable: {err} <button type="button" className="underline" onClick={() => load()}>Retry</button></> : "Loading AI balance…"}
      </div>
    );

  const low = data.balance !== null && data.balance < LOW;
  const money = data.balance === null ? "unknown" : `${data.currency === "USD" ? "$" : `${data.currency ?? ""} `}${data.balance.toFixed(2)}`;

  return (
    <div className="card flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-3 text-xs lg:col-span-2">
      <p>
        <span className="font-semibold">{data.model}</span> <span className="text-muted">· pay per use</span>
      </p>
      <p>
        Balance <span className="num font-semibold" style={{ color: low ? "var(--bad)" : undefined }}>{money}</span>
        {data.available === false && <span className="ml-2 text-bad">Top up to keep Ask working</span>}
        {low && data.available !== false && <span className="ml-2 text-muted">running low</span>}
      </p>
      {err && <p className="basis-full text-muted">Could not refresh: {err}</p>}
    </div>
  );
}
