const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const phpWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function peso(centavos: number): string {
  return php.format(centavos / 100).replace("PHP", "₱");
}

export function pesoWhole(centavos: number): string {
  return phpWhole.format(Math.round(centavos / 100)).replace("PHP", "₱");
}

export function pesoCompact(centavos: number): string {
  const v = centavos / 100;
  if (Math.abs(v) >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `₱${(v / 1000).toFixed(1)}k`;
  return pesoWhole(centavos);
}

export function toCentavos(input: string | number): number | null {
  const s = String(input).replace(/[₱,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function fromCentavos(centavos: number): string {
  return (centavos / 100).toFixed(2);
}
