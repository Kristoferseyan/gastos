import { Nav } from "@/components/Nav";
import { aiEnabled } from "@/lib/ai";
import { authEnabled } from "@/lib/auth";
import { todayManila } from "@/lib/dates";
import { distinctPaymentMethods, listCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const categories = listCategories();
  return (
    <>
      <Nav categories={categories} today={todayManila()} methods={distinctPaymentMethods()} authEnabled={authEnabled()} aiEnabled={aiEnabled()} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:pb-12">{children}</main>
    </>
  );
}
