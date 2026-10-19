"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RestorePanel() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm("Restoring replaces everything currently in the app with the contents of this backup. A safety copy of the current database is written first. Continue?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/restore", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Restore failed" });
      else {
        setMsg({ ok: true, text: `Restored ${data.counts.transactions} transactions, ${data.counts.bills} bills, ${data.counts.categories} categories.` });
        form.reset();
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Restore from JSON backup</h2>
      <p className="mt-1 text-sm text-muted">Pick a file exported with “Backup JSON”. The current data is replaced. A copy of the current database is saved to the backups folder first.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept="application/json,.json" required className="text-sm" />
        <button className="btn btn-danger btn-sm" disabled={busy}>{busy ? "Restoring…" : "Restore"}</button>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </section>
  );
}
