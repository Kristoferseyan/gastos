import { getDb, schema } from "@/lib/db";
import { todayManila } from "@/lib/dates";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const payload = {
    app: "gastos",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: db.select().from(schema.categories).all(),
    recurring: db.select().from(schema.recurring).all(),
    bills: db.select().from(schema.bills).all(),
    transactions: db.select().from(schema.transactions).all(),
    income: db.select().from(schema.income).all(),
    settings: db.select().from(schema.settings).all(),
    memory: db.select().from(schema.memory).all(),
    chatMessages: db.select().from(schema.chatMessages).all(),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="gastos-backup-${todayManila()}.json"` },
  });
}
