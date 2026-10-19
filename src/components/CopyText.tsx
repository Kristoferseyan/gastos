"use client";
import { useState } from "react";

export function CopyText({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("fail");
      setOpen(true);
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          {state === "done" ? "Copied ✓" : state === "fail" ? "Copy failed, select the text below" : "Copy for ChatGPT"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Preview"}</button>
      </div>
      {open && (
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line p-3 text-xs leading-relaxed" style={{ background: "var(--card-2)" }}>{text}</pre>
      )}
    </div>
  );
}
