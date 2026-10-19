export const TZ = "Asia/Manila";

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function todayManila(): string {
  return ymd.format(new Date());
}

export function currentMonth(): string {
  return todayManila().slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dateInMonth(month: string, day: number): string {
  const d = Math.min(Math.max(1, day), daysInMonth(month));
  return `${month}-${String(d).padStart(2, "0")}`;
}

export function dueDateFor(month: string, dueDay: number, dueDaysBefore = 0): string {
  if (dueDaysBefore > 0) {
    const first = utc(`${month}-01`);
    first.setUTCDate(first.getUTCDate() - dueDaysBefore);
    return first.toISOString().slice(0, 10);
  }
  return dateInMonth(month, dueDay);
}

export function duePhrase(dueDay: number, dueDaysBefore = 0): string {
  if (dueDaysBefore > 0) return `${dueDaysBefore} day${dueDaysBefore === 1 ? "" : "s"} before the month starts`;
  const n = dueDay;
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `on the ${n}${suffix}`;
}

export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

export function lastMonths(count: number, from = currentMonth()): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(from, i - count + 1));
}

const monthLong = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", year: "2-digit" });
const monthShortOnly = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" });
const dateLong = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const dateShort = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", day: "numeric", month: "short" });

function utc(date: string) {
  return new Date(`${date.length === 7 ? `${date}-01` : date}T00:00:00Z`);
}

export function fmtMonth(month: string): string {
  return monthLong.format(utc(month));
}
export function fmtMonthShort(month: string): string {
  return monthShort.format(utc(month));
}
export function fmtMonthTiny(month: string): string {
  return monthShortOnly.format(utc(month));
}
export function fmtDate(date: string): string {
  return dateLong.format(utc(date));
}
export function fmtDateShort(date: string): string {
  return dateShort.format(utc(date));
}

export function daysUntil(date: string, from = todayManila()): number {
  return Math.round((utc(date).getTime() - utc(from).getTime()) / 86400000);
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = utc(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
