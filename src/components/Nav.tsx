"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category } from "@/lib/db/schema";
import { ThemeToggle } from "./ThemeToggle";
import { Dialog } from "./Dialog";
import { TransactionForm } from "./TransactionForm";
import { ReceiptForm } from "./ReceiptForm";
import { logout } from "@/actions/auth";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/transactions", label: "Transactions" },
  { href: "/bills", label: "Bills" },
  { href: "/utilities", label: "Utilities" },
  { href: "/monthly", label: "Monthly" },
  { href: "/reports", label: "Reports" },
  { href: "/chat", label: "Ask" },
  { href: "/settings", label: "Settings" },
];

const TABS = [
  { href: "/", label: "Home", icon: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { href: "/transactions", label: "Entries", icon: <path d="M4 5h16M4 12h16M4 19h10" /> },
  { href: "/bills", label: "Bills", icon: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /> },
  { href: "/monthly", label: "Monthly", icon: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /> },
];

const MORE = [
  { href: "/chat", label: "Ask" },
  { href: "/utilities", label: "Utilities" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ categories, today, methods, authEnabled, aiEnabled }: { categories: Category[]; today: string; methods: string[]; authEnabled: boolean; aiEnabled: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "receipt">("single");

  function openAs(m: "single" | "receipt") {
    setMode(m);
    setOpen(true);
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "n" || (e.key === "r" && aiEnabled)) && !e.metaKey && !e.ctrlKey && !e.altKey && !open) {
        const t = e.target as HTMLElement;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
        e.preventDefault();
        openAs(e.key === "r" ? "receipt" : "single");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, aiEnabled]);

  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href)) ? "page" : undefined;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="num flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm text-accent-ink">₱</span>
            Gastos
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" aria-current={current(l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="btn btn-primary btn-sm hidden md:inline-flex" onClick={() => openAs("single")} title="Add expense (N)">
              + Add expense
            </button>
            {aiEnabled && (
              <button type="button" className="btn btn-sm hidden md:inline-flex" onClick={() => openAs("receipt")} title="Paste a receipt (R)">
                Receipt
              </button>
            )}
            <ThemeToggle />
            <details className="relative md:hidden">
              <summary className="btn btn-ghost btn-sm list-none" aria-label="More pages">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
              </summary>
              <div className="card absolute right-0 mt-1 flex w-40 flex-col p-1 shadow-lg">
                {MORE.map((l) => (
                  <Link key={l.href} href={l.href} className="nav-link" aria-current={current(l.href)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </details>
            {authEnabled && (
              <form action={logout}>
                <button className="btn btn-ghost btn-sm" title="Lock">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        <div className="flex items-stretch">
          {TABS.slice(0, 2).map((t) => (
            <Link key={t.href} href={t.href} className="tab" aria-current={current(t.href)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">{t.icon}</svg>
              {t.label}
            </Link>
          ))}
          <div className="flex flex-1 items-center justify-center">
            <button type="button" onClick={() => openAs("single")} className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-accent-ink shadow-lg" aria-label="Add expense">
              +
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <Link key={t.href} href={t.href} className="tab" aria-current={current(t.href)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">{t.icon}</svg>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "receipt" ? "Add from receipt" : "Add expense"}>
        {aiEnabled && (
          <div className="seg mb-4" role="group" aria-label="Entry mode">
            <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")}>One expense</button>
            <button type="button" aria-pressed={mode === "receipt"} onClick={() => setMode("receipt")}>Receipt / list</button>
          </div>
        )}
        {mode === "receipt" ? (
          <ReceiptForm key={open ? "open" : "closed"} categories={categories} today={today} methods={methods} onDone={() => setOpen(false)} />
        ) : (
          <TransactionForm key={open ? "open" : "closed"} categories={categories} today={today} methods={methods} onDone={() => setOpen(false)} />
        )}
      </Dialog>
    </>
  );
}
