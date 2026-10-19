import { Money } from "./Money";

export function StatTile({ label, value, hint, tone }: { label: string; value: number; hint?: React.ReactNode; tone?: "setup" | "muted" }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "setup" ? "text-setup" : tone === "muted" ? "text-muted" : ""}`}>
        <Money value={value} />
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
