import { createBackup, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = await createBackup(`manual-${stamp}`);
  return Response.json({ ok: true, file, backups: listBackups() });
}

export function GET() {
  return Response.json({ backups: listBackups() });
}
