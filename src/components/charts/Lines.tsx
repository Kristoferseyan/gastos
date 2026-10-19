"use client";
import { useState } from "react";
import { peso } from "@/lib/money";

export type LinePoint = { label: string; value: number; hint?: string };

export function Lines({ data, height = 150, color = "var(--accent)", unit, ariaLabel }: { data: LinePoint[]; height?: number; color?: string; unit?: string; ariaLabel: string }) {
  const format = (v: number) => (unit ? `${v} ${unit}` : peso(v));
  const [hover, setHover] = useState<number | null>(null);
  const w = 100;
  const padX = 6;
  const plotH = height;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x = (i: number) => (n === 1 ? w / 2 : padX + (i / (n - 1)) * (w - padX * 2));
  const y = (v: number) => 10 + (1 - v / max) * (plotH - 14);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(" ");

  if (!n) return <p className="text-sm text-muted">No entries yet.</p>;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" role="img" aria-label={ariaLabel} style={{ height }}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={w} y1={y(f * max)} y2={y(f * max)} stroke="var(--line)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
            <rect x={x(i) - (w / n) / 2} y={0} width={w / n} height={height} fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 1.6 : 1.1} fill={color} stroke="var(--card)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <div className="relative mt-1 h-4 text-[0.68rem] text-muted">
        {data.map((d, i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>{d.label}</span>
        ))}
      </div>
      {hover !== null && (
        <div className="viz-tip" style={{ left: `${x(hover)}%`, top: `${(y(data[hover].value) / height) * 100}%` }}>
          <div className="font-semibold">{data[hover].hint ?? data[hover].label}</div>
          <div className="num">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
