"use server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { aiEnabled, aiImages } from "@/lib/ai";
import { canonicalTopic, listMemory, listMessages, startTurn } from "@/lib/chat";
import { deleteImages, imagesOf, saveImages } from "@/lib/chat-images";
import type { ChatMessage, MemoryFact } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";

export async function sendMessage(text: unknown, images?: unknown): Promise<ActionResult<{ id: number }>> {
  if (!aiEnabled()) return { ok: false, error: "AI is not configured on this server" };
  const t = typeof text === "string" ? text.trim() : "";
  const count = Array.isArray(images) ? images.length : 0;
  if (!t && !count) return { ok: false, error: "Type a question first" };
  if (t.length > 6000) return { ok: false, error: "Keep it under 6,000 characters" };
  if (count && !aiImages()) return { ok: false, error: "The current AI model cannot read images. Type what the photo shows instead." };
  if (listMessages().some((m) => m.status === "pending")) return { ok: false, error: "Still answering the last question" };
  const saved = saveImages(images);
  if ("error" in saved) return { ok: false, error: saved.error };
  return { ok: true, data: { id: startTurn(t, saved.names) } };
}

export async function retryLast(): Promise<ActionResult<{ id: number }>> {
  if (!aiEnabled()) return { ok: false, error: "AI is not configured on this server" };
  const msgs = listMessages();
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== "assistant" || last.status !== "error") return { ok: false, error: "Nothing to retry" };
  const question = [...msgs].reverse().find((m) => m.role === "user" && m.id < last.id);
  if (!question) return { ok: false, error: "Nothing to retry" };
  getDb().delete(schema.chatMessages).where(sql`${schema.chatMessages.id} >= ${question.id}`).run();
  return { ok: true, data: { id: startTurn(question.content, imagesOf(question)) } };
}

export async function pollChat(): Promise<{ messages: ChatMessage[]; memory: MemoryFact[] }> {
  return { messages: listMessages(), memory: listMemory() };
}

export async function clearChat(): Promise<ActionResult> {
  if (listMessages().some((m) => m.status === "pending")) return { ok: false, error: "Wait for the current answer first" };
  const gone = getDb().delete(schema.chatMessages).where(sql`${schema.chatMessages.status} != 'pending'`).returning({ images: schema.chatMessages.images }).all();
  deleteImages(gone.flatMap(imagesOf));
  revalidatePath("/chat");
  return { ok: true };
}

function clean(topic: unknown, fact: unknown): { topic: string; fact: string } | null {
  const t = typeof topic === "string" ? topic.trim().slice(0, 60) : "";
  const f = typeof fact === "string" ? fact.trim().slice(0, 600) : "";
  return f ? { topic: canonicalTopic(t, listMemory().map((m) => m.topic)), fact: f } : null;
}

export async function addFact(topic: unknown, fact: unknown): Promise<ActionResult> {
  const v = clean(topic, fact);
  if (!v) return { ok: false, error: "Write the fact first" };
  getDb().insert(schema.memory).values({ ...v, source: "manual" }).run();
  revalidatePath("/chat");
  return { ok: true };
}

export async function updateFact(id: unknown, topic: unknown, fact: unknown): Promise<ActionResult> {
  const v = clean(topic, fact);
  if (typeof id !== "number" || !v) return { ok: false, error: "Write the fact first" };
  getDb().update(schema.memory).set({ ...v, updatedAt: sql`(datetime('now'))` }).where(eq(schema.memory.id, id)).run();
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteFact(id: unknown): Promise<ActionResult> {
  if (typeof id !== "number") return { ok: false, error: "Bad id" };
  getDb().delete(schema.memory).where(eq(schema.memory.id, id)).run();
  revalidatePath("/chat");
  return { ok: true };
}
