import { eq } from "drizzle-orm";
import type { DB } from "./index";
import { categories, settings } from "./schema";

export const SEED_CATEGORIES = [
  { name: "Rent", group: "rent", color: "#2a78d6", sort: 10 },
  { name: "Groceries", group: "groceries", color: "#1baf7a", sort: 20 },
  { name: "Household Supplies", group: "household", color: "#eda100", sort: 30 },
  { name: "Electricity", group: "utilities", color: "#eb6834", sort: 40, utilityUnit: "kWh" },
  { name: "Water", group: "utilities", color: "#4a3aa7", sort: 50, utilityUnit: "m³" },
  { name: "Eating Out", group: "other", color: "#e87ba4", sort: 60 },
  { name: "Transport / Gas", group: "other", color: "#008300", sort: 70 },
  { name: "Personal Care", group: "other", color: "#e34948", sort: 80 },
  { name: "Apartment Setup / Furniture", group: "household", color: "#8a7a5e", sort: 90 },
  { name: "Subscriptions", group: "personal", color: "#8e5bd6", sort: 95 },
  { name: "Miscellaneous", group: "other", color: "#6b6a66", sort: 100 },
] as const;

export function seedIfEmpty(db: DB) {
  const seeded = db.select().from(settings).where(eq(settings.key, "seeded")).get();
  if (seeded) return;

  db.transaction((tx) => {
    for (const c of SEED_CATEGORIES) {
      tx.insert(categories).values({ name: c.name, group: c.group, color: c.color, sort: c.sort, utilityUnit: "utilityUnit" in c ? c.utilityUnit : null }).run();
    }

    tx.insert(settings).values([
      { key: "seeded", value: "1" },
      { key: "income_enabled", value: "0" },
    ]).run();
  });
}
