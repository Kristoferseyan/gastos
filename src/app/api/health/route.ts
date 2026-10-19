import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  getDb();
  return Response.json({ ok: true, time: new Date().toISOString() });
}
