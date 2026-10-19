import { incomeEnabled, listCategories, listIncome, listRecurring } from "@/lib/queries";
import { listBackups, backupKeep } from "@/lib/backup";
import { authEnabled } from "@/lib/auth";
import { currentMonth, todayManila } from "@/lib/dates";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { RecurringManager } from "@/components/settings/RecurringManager";
import { IncomeManager } from "@/components/settings/IncomeManager";
import { BackupPanel } from "@/components/settings/BackupPanel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section id="recurring" className="card p-5">
        <h2 className="mb-1 font-semibold">Recurring expenses</h2>
        <p className="mb-3 text-sm text-muted">Predictable bills with a fixed amount. Each one creates its bill automatically every month. Pause it to stop generating new bills.</p>
        <RecurringManager rows={listRecurring()} categories={listCategories()} currentMonth={currentMonth()} />
      </section>
      <section id="categories" className="card p-5">
        <h2 className="mb-1 font-semibold">Categories & budgets</h2>
        <p className="mb-3 text-sm text-muted">The group decides which line a category lands on in the monthly view. A budget is optional and only used for the over-budget warning on the dashboard.</p>
        <CategoryManager rows={listCategories(true)} />
      </section>
      <section id="income" className="card p-5">
        <h2 className="mb-1 font-semibold">Income</h2>
        <IncomeManager enabled={incomeEnabled()} rows={listIncome().slice(0, 24)} today={todayManila()} />
      </section>
      <section id="backups" className="card p-5">
        <h2 className="mb-1 font-semibold">Backups</h2>
        <BackupPanel backups={listBackups()} keep={backupKeep()} />
      </section>
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Access</h2>
        <p className="text-sm text-muted">
          {authEnabled() ? "Password lock is on (APP_PASSWORD is set). Use the lock icon in the header to sign out." : "No password is set. Set APP_PASSWORD in the .env file on the server to require a password."}
        </p>
        <p className="mt-2 text-xs text-muted">Keyboard: press N anywhere to add an expense.</p>
      </section>
    </div>
  );
}
