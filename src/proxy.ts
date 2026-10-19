import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isValidSession, SESSION_COOKIE } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/login" || pathname === "/api/health" || pathname === "/api/bills/upcoming" || pathname.startsWith("/api/mcp/") || pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname.startsWith("/icons/");
  const ok = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (isPublic) {
    if (pathname === "/login" && ok) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
