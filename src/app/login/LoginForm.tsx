"use client";
import { useActionState } from "react";
import { login } from "@/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoFocus autoComplete="current-password" className="field" required />
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
