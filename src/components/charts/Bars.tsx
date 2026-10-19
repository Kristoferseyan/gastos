"use client";
import { useState } from "react";
import { peso, pesoCompact } from "@/lib/money";

export type BarDatum = { label: string; value: number; sub?: number; color?: string; hint?: string };

export function Bars({ data, height = 160, color = "var(--accent)", subColor = "var(--setup)", subLabel = "Move-in", ariaLabel }: { data: BarDatum[]; height?: number; color?: string; subColor?: string; subLabel?: string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 100;
  const max = Math.max(1, ...data.map((d) => d.value + (d.sub ?? 0)));
  const n = data.length;
  const gap = 2;
  const slot = w / n;
  const bw = Math.max(2, slot - gap * 2);
  const plotH = height;
  const ticks = [0.5, 1].map((f) => f * max);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-auto w-full" role="img" aria-label={ariaLabel} style={{ height }}>
        {ticks.map((t) => (
          <line key={t} x1={0} x2={w} y1={plotH - (t / max) * plotH} y2={plotH - (t / max) * plotH} stroke="var(--line)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const x = i * slot + gap;
          const h = (d.value / max) * plotH;
          const sh = ((d.sub ?? 0) / max) * plotH;
          const dim = hover !== null && hover !== i;
          return (
            <g key={i} opacity={dim ? 0.45 : 1} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
              <rect x={x - gap} y={0} width={slot} height={height} fill="transparent" />
              {sh > 0 && <rect x={x} y={plotH - h - sh} width={bw} height={Math.max(sh - 0.5, 0)} fill={subColor} opacity={0.55} rx={0.6} />}
              <rect x={x} y={plotH - h} width={bw} height={h} fill={d.color ?? color} rx={0.6} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[0.68rem] text-muted">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center">{d.label}</span>
        ))}
      </div>
      {hover !== null && data[hover] && (
        <div className="viz-tip" style={{ left: `${((hover + 0.5) / n) * 100}%`, top: `${((plotH - ((data[hover].value + (data[hover].sub ?? 0)) / max) * plotH) / height) * 100}%` }}>
          <div className="font-semibold">{data[hover].hint ?? data[hover].label}</div>
          <div className="num">{peso(data[hover].value)}</div>
          {data[hover].sub ? <div className="num opacity-80">+ {subLabel} {pesoCompact(data[hover].sub!)}</div> : null}
        </div>
      )}
    </div>
  );
}
