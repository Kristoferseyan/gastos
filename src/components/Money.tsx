import { peso } from "@/lib/money";

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`num ${className}`}>{peso(value)}</span>;
}
