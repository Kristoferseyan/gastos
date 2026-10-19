"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backupNow } from "@/actions/settings";

type B = { name: string; size: number; mtime: string };

export function BackupPanel({ backups, keep }: { backups: B[]; keep: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">A SQLite snapshot is written automatically once a day into the backups folder next to the database. The newest {keep} are kept. You can also download a JSON backup and restore from it on the Reports page.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { const r = await backupNow(); setMsg(r.ok ? `Saved ${r.data?.file.split("/").pop()}` : r.error); router.refresh(); })}>{pending ? "Backing up…" : "Back up now"}</button>
        <a className="btn btn-sm" href="/api/export/json">Download JSON backup</a>
        <a className="btn btn-sm" href="/api/export/csv">Download CSV</a>
      </div>
      {msg && <p className="text-good">{msg}</p>}
      {backups.length === 0 ? <p className="text-muted">No snapshots yet. The first one is written at the scheduled hour, or press “Back up now”.</p> : (
        <ul className="divide-y divide-line">
          {backups.map((b) => (
            <li key={b.name} className="flex items-center justify-between py-1.5"><span className="num">{b.name}</span><span className="num text-muted">{(b.size / 1024).toFixed(0)} KB</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
