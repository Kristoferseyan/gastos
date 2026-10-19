import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./db";
import type { ChatMessage } from "./db/schema";

export const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_DIR = path.join(DATA_DIR, "chat-images");
const NAME_RE = /^[0-9a-f-]{36}\.jpg$/;
const DATA_URL_RE = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

export function imagesOf(m: Pick<ChatMessage, "images">): string[] {
  try {
    const v = JSON.parse(m.images);
    return Array.isArray(v) ? v.filter((n) => typeof n === "string" && NAME_RE.test(n)) : [];
  } catch {
    return [];
  }
}

export function imagePath(name: string): string | null {
  return NAME_RE.test(name) ? path.join(IMAGE_DIR, name) : null;
}

export function saveImages(dataUrls: unknown): { names: string[] } | { error: string } {
  if (dataUrls == null) return { names: [] };
  if (!Array.isArray(dataUrls)) return { error: "Bad image upload" };
  if (dataUrls.length > MAX_IMAGES) return { error: `Attach up to ${MAX_IMAGES} images` };
  const buffers: Buffer[] = [];
  for (const d of dataUrls) {
    const m = typeof d === "string" ? d.match(DATA_URL_RE) : null;
    if (!m) return { error: "Images must be JPEG" };
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX_BYTES) return { error: "One of the images is too large (5 MB max)" };
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return { error: "One of the images is not a valid JPEG" };
    buffers.push(buf);
  }
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const names = buffers.map((buf) => {
    const name = `${randomUUID()}.jpg`;
    fs.writeFileSync(path.join(IMAGE_DIR, name), buf);
    return name;
  });
  return { names };
}

export function readImagesBase64(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const p = imagePath(n);
    if (!p) continue;
    try {
      out.push(fs.readFileSync(p).toString("base64"));
    } catch {
      console.warn(`[chat] image ${n} is missing on disk`);
    }
  }
  return out;
}

export function deleteImages(names: string[]) {
  for (const n of names) {
    const p = imagePath(n);
    if (p) fs.rmSync(p, { force: true });
  }
}
