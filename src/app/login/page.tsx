import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!authEnabled()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2 font-semibold">
          <span className="num flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink">₱</span>
          Gastos
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
