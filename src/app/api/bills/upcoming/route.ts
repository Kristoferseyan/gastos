import { listBills } from "@/lib/queries";
import { ensureRecurringBills } from "@/lib/recurring";
import { currentMonth, daysUntil, todayManila } from "@/lib/dates";

export const dynamic = "force-dynamic";

function tokenMatches(header: string | null): boolean {
  const expected = process.env.API_TOKEN || "";
  const given = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function GET(req: Request) {
  if (!process.env.API_TOKEN) return Response.json({ error: "API_TOKEN is not set on the server" }, { status: 503 });
  if (!tokenMatches(req.headers.get("authorization"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  ensureRecurringBills();
  const today = todayManila();
  const bills = listBills()
    .filter((b) => b.status !== "paid")
    .map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category.name,
      color: b.category.color,
      amount: b.amount,
      billingMonth: b.billingMonth,
      dueDate: b.dueDate,
      daysUntil: b.dueDate ? daysUntil(b.dueDate, today) : null,
      status: b.status,
    }))
    .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1);
  return Response.json({ today, month: currentMonth(), count: bills.length, totalDue: bills.reduce((s, b) => s + b.amount, 0), bills }, { headers: { "cache-control": "no-store" } });
}
