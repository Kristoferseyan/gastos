"use client";
import { useState } from "react";
import { peso } from "@/lib/money";

export type Segment = { label: string; value: number; color: string };

export function LivingCostBar({ segments, setup, setupLabel = "Move-in / setup" }: { segments: Segment[]; setup: number; setupLabel?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const normal = segments.reduce((s, x) => s + x.value, 0);
  const total = normal + setup;
  if (!total) return <div className="bar-track" aria-hidden />;
  const pct = (v: number) => `${(v / total) * 100}%`;
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-lg" role="img" aria-label="Spending this month by group">
        {visible.map((s) => (
          <div
            key={s.label}
            style={{ width: pct(s.value), background: s.color, opacity: hover && hover !== s.label ? 0.4 : 1 }}
            className="relative min-w-[3px] transition-opacity"
            onMouseEnter={() => setHover(s.label)}
            onMouseLeave={() => setHover(null)}
            title={`${s.label}: ${peso(s.value)}`}
          />
        ))}
        {setup > 0 && (
          <div
            style={{ width: pct(setup), opacity: hover && hover !== setupLabel ? 0.4 : 1 }}
            className="hatch relative ml-1 min-w-[3px] rounded-r-md border border-setup/60"
            onMouseEnter={() => setHover(setupLabel)}
            onMouseLeave={() => setHover(null)}
            title={`${setupLabel}: ${peso(setup)}`}
          />
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {visible.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5" onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}>
            <span className="dot" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="num">{peso(s.value)}</span>
          </li>
        ))}
        {setup > 0 && (
          <li className="flex items-center gap-1.5" onMouseEnter={() => setHover(setupLabel)} onMouseLeave={() => setHover(null)}>
            <span className="dot hatch border border-setup/60" />
            <span className="text-muted">{setupLabel}</span>
            <span className="num">{peso(setup)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
