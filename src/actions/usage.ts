"use server";
import { aiBalance, type AiBalance } from "@/lib/ai";
import { cookies } from "next/headers";
import { authEnabled, isValidSession, SESSION_COOKIE } from "@/lib/auth";
import type { ActionResult } from "@/lib/validation";

async function signedIn(): Promise<boolean> {
  return !authEnabled() || isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function getUsage(): Promise<ActionResult<AiBalance>> {
  if (!(await signedIn())) return { ok: false, error: "Sign in again" };
  try {
    return { ok: true, data: await aiBalance() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read the AI balance" };
  }
}
