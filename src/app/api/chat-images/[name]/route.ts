import fs from "node:fs";
import { imagePath } from "@/lib/chat-images";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const p = imagePath((await params).name);
  if (!p || !fs.existsSync(p)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(p), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" } });
}
