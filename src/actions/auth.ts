"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, passwordMatches, sessionToken, SESSION_COOKIE } from "@/lib/auth";

let lastFailure = 0;

export async function login(prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  if (!authEnabled()) redirect("/");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const since = Date.now() - lastFailure;
  if (since < 1500) await new Promise((r) => setTimeout(r, 1500 - since));
  if (!passwordMatches(password)) {
    lastFailure = Date.now();
    return { error: "Wrong password" };
  }
  const h = await headers();
  const secure = (h.get("x-forwarded-proto") ?? "").includes("https");
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
