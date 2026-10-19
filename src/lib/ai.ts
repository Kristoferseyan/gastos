import "server-only";
import type { Category } from "./db/schema";

export type DraftItem = {
  name: string;
  amount: number;
  categoryId: number;
  date: string | null;
  paymentMethod: string | null;
  confidence: number;
};

type RawItem = { name: string; amount: number; category: string; date: string | null; payment_method: string | null; confidence: number };

export function aiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export function aiImages(): boolean {
  return process.env.AI_IMAGES === "true";
}

function aiBase(): string {
  return (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
}

function aiModel(): string {
  return process.env.AI_MODEL || "deepseek-v4-pro";
}

type Completion = { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };

export async function aiJson<T>(prompt: string, schema: object, opts: { timeoutMs?: number; timeoutMessage?: string; images?: string[] } = {}): Promise<{ output: T; ms: number }> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI is not configured (AI_API_KEY)");
  const system = `Answer with one JSON object and nothing else, matching this JSON Schema exactly:\n${JSON.stringify(schema)}`;
  const content = opts.images?.length
    ? [{ type: "text", text: prompt }, ...opts.images.map((b64) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }))]
    : prompt;
  const started = Date.now();
  // JSON mode guarantees JSON, not the schema, so one retry covers the rare truncated or empty reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${aiBase()}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: aiModel(), response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content }] }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 150_000),
        cache: "no-store",
      });
    } catch (e) {
      throw new Error(e instanceof Error && e.name === "TimeoutError" ? opts.timeoutMessage ?? "The AI took too long. Try a shorter receipt." : "Could not reach the AI provider");
    }
    const body = (await res.json().catch(() => null)) as Completion | null;
    if (!res.ok) throw new Error(body?.error?.message ? `AI provider: ${body.error.message}` : `AI provider error (${res.status})`);
    try {
      const output = JSON.parse(body?.choices?.[0]?.message?.content ?? "") as T;
      if (output && typeof output === "object") return { output, ms: Date.now() - started };
    } catch {}
  }
  throw new Error("The AI did not return a usable answer. Try again.");
}

const GROUP_HINT: Record<Category["group"], string> = {
  rent: "monthly rent for the apartment",
  utilities: "utility bills (electricity, water, internet)",
  groceries: "food and drinks bought to cook or keep at home (supermarket, palengke, sari-sari)",
  household: "cleaning supplies, toiletries for the home, kitchen tools, furniture, appliances, repairs",
  other: "",
  personal: "personal subscriptions and services not tied to the apartment (ChatGPT, Spotify, Netflix, mobile load, gym)",
};

function receiptSchema(names: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "amount", "category", "date", "payment_method", "confidence"],
          properties: {
            name: { type: "string", description: "Short readable item name, brand plus item, Title Case" },
            amount: { type: "number", description: "Line total in pesos" },
            category: { type: "string", enum: names },
            date: { type: ["string", "null"], description: "YYYY-MM-DD only when the text states a date, else null" },
            payment_method: { type: ["string", "null"], description: "Cash, GCash, Maya, Card… only when the text states it, else null" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  };
}

function receiptPrompt(text: string, categories: Category[], today: string): string {
  const catLines = categories.map((c) => `- ${c.name}${GROUP_HINT[c.group] ? ` — ${GROUP_HINT[c.group]}` : ""}`).join("\n");
  return `You turn receipt text or quick expense notes from an apartment in the Philippines into expense entries. Do not run commands or read files; answer from the text alone.

Today is ${today}. Amounts are Philippine pesos. The text may mix English, Tagalog and Bisaya (pamasahe = fare, bigas = rice, tubig = water, kuryente = electricity, sabon = soap, ulam = food/dish).

Rules:
- One entry per purchased line item. If a line has quantity x unit price, the amount is the line total.
- Skip subtotal, total, VAT, discount summary, cash tendered and change lines; they are not items. If a discount clearly applies to one item, reduce that item's amount instead.
- If the text only gives a store or place and a total (e.g. "SM groceries 850.25"), that is one entry.
- Keep names short and readable (brand plus item, Title Case). Never invent items that are not in the text.
- date: YYYY-MM-DD only if the text states one (assume the current year when the year is missing); otherwise null. payment_method only if the text states it; otherwise null.
- Pick the closest category from this list, using the exact name. Use "${categories.find((c) => c.name === "Miscellaneous")?.name ?? categories[categories.length - 1]?.name}" only when nothing fits. confidence is 0 to 1.

Categories:
${catLines}

Text:
"""
${text}
"""`;
}

export async function parseReceiptText(text: string, categories: Category[], today: string): Promise<{ items: DraftItem[]; ms: number }> {
  const active = categories.filter((c) => !c.archived);
  const names = active.map((c) => c.name);
  const { output, ms } = await aiJson<{ items: RawItem[] }>(receiptPrompt(text, active, today), receiptSchema(names));
  const byName = new Map(active.map((c) => [c.name.toLowerCase(), c]));
  const fallback = active.find((c) => c.name === "Miscellaneous") ?? active.find((c) => c.group === "other") ?? active[0];
  const items: DraftItem[] = [];
  for (const raw of output.items ?? []) {
    const amount = Math.round(Number(raw.amount) * 100);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const cat = byName.get(String(raw.category ?? "").toLowerCase()) ?? fallback;
    if (!cat) continue;
    items.push({
      name: String(raw.name ?? "").trim().slice(0, 200) || "Item",
      amount,
      categoryId: cat.id,
      date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null,
      paymentMethod: typeof raw.payment_method === "string" && raw.payment_method.trim() ? raw.payment_method.trim().slice(0, 60) : null,
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
    });
  }
  return { items, ms };
}

export type AiBalance = { model: string; balance: number | null; currency: string | null; available: boolean | null; fetchedAt: number };

export async function aiBalance(): Promise<AiBalance> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI is not configured (AI_API_KEY)");
  let res: Response;
  try {
    res = await fetch(`${aiBase()}/user/balance`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new Error("Could not reach the AI provider");
  }
  const body = (await res.json().catch(() => null)) as { is_available?: boolean; balance_infos?: { currency: string; total_balance: string }[] } | null;
  if (!res.ok || !body) throw new Error(`Balance unavailable (${res.status})`);
  const info = body.balance_infos?.[0];
  return { model: aiModel(), balance: info ? Number(info.total_balance) : null, currency: info?.currency ?? null, available: body.is_available ?? null, fetchedAt: Date.now() };
}
