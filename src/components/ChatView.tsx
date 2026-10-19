"use client";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { ChatMessage, MemoryFact } from "@/lib/db/schema";
import type { LoggedEntry, MemoryChange } from "@/lib/chat";
import { peso } from "@/lib/money";
import { UsageMeter } from "./UsageMeter";
import { addFact, clearChat, deleteFact, pollChat, retryLast, sendMessage, updateFact } from "@/actions/chat";
import { TOPICS } from "@/lib/chat-topics";

const SUGGESTIONS = [
  "How am I doing this month?",
  "Can I afford a ₱3,000 couch this week?",
  "How much can I put into savings after rent this month?",
];

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="num text-[0.9em]">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={blocks.length} className={list.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length} className="font-semibold">{inline(heading[1])}</p>);
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

function changes(m: ChatMessage): MemoryChange[] {
  try {
    const v = JSON.parse(m.memoryChanges);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function logged(m: ChatMessage): LoggedEntry[] {
  try {
    const v = JSON.parse(m.loggedEntries);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function pics(m: ChatMessage): string[] {
  try {
    const v = JSON.parse(m.images);
    return Array.isArray(v) ? v.filter((n) => typeof n === "string") : [];
  } catch {
    return [];
  }
}

const VERB = { add: "Remembered", update: "Updated", remove: "Forgot" } as const;

const MAX_IMAGES = 4;
const MAX_SIDE = 1600;

type Attachment = { id: string; url: string };

async function toJpeg(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(src);
  }
}

function Elapsed({ since }: { since: string }) {
  const start = useMemo(() => new Date(since.replace(" ", "T") + "Z").getTime(), [since]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="num">{Math.max(0, Math.round((now - start) / 1000))}s</span>;
}

export function ChatView({ initialMessages, initialMemory, canAttach = false }: { initialMessages: ChatMessage[]; initialMemory: MemoryFact[]; canAttach?: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [memory, setMemory] = useState(initialMemory);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  const [view, setView] = useState<"chat" | "memory">("chat");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const waiting = messages.some((m) => m.status === "pending");
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch("ontouchstart" in window), []);

  async function refresh() {
    const r = await pollChat();
    setMessages(r.messages);
    setMemory(r.memory);
  }

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [waiting]);

  useEffect(() => {
    if (view !== "chat") return;
    const id = requestAnimationFrame(() => {
      const el = box.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length, waiting, view]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  async function attach(files: Iterable<File>) {
    if (!canAttach) return;
    const images = [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return;
    const room = MAX_IMAGES - attachments.length - preparing;
    if (room <= 0) {
      setErr(`Up to ${MAX_IMAGES} images per message`);
      return;
    }
    setErr(images.length > room ? `Up to ${MAX_IMAGES} images per message; added the first ${room}` : null);
    const batch = images.slice(0, room);
    setPreparing((n) => n + batch.length);
    for (const f of batch) {
      try {
        const url = await toJpeg(f);
        setAttachments((a) => [...a, { id: crypto.randomUUID(), url }]);
      } catch {
        setErr(`Could not read ${f.name || "that image"}. Try a JPEG or PNG, or a screenshot of it.`);
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  }

  function send(q = text) {
    setErr(null);
    start(async () => {
      const res = await sendMessage(q, attachments.map((a) => a.url));
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setText("");
      setAttachments([]);
      await refresh();
    });
  }

  function retry() {
    setErr(null);
    start(async () => {
      const res = await retryLast();
      if (!res.ok) setErr(res.error);
      await refresh();
    });
  }

  function clear() {
    start(async () => {
      await clearChat();
      setConfirmClear(false);
      await refresh();
    });
  }

  const answered = messages.filter((m) => m.role === "assistant" && m.status !== "pending").length;
  const canSend = Boolean(text.trim() || attachments.length) && !preparing && !waiting && !pending;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Ask</h1>
        <div className="seg" role="tablist" aria-label="Chat or memory">
          <button type="button" role="tab" aria-pressed={view === "chat"} onClick={() => setView("chat")}>Chat</button>
          <button type="button" role="tab" aria-pressed={view === "memory"} onClick={() => setView("memory")}>Memory <span className="num font-normal">{memory.length}</span></button>
        </div>
      </div>
      <UsageMeter tick={answered} />
      <section
        className={`card relative min-h-0 flex-1 flex-col ${view === "chat" ? "flex" : "hidden"}`}
        onDragOver={(e) => {
          if (!canAttach || ![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void attach(e.dataTransfer.files);
        }}
      >
        {dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-accent bg-accent-soft/80 text-sm font-semibold">Drop images to attach</div>}
        <div ref={box} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-3 py-6 text-sm text-muted">
              <p>Ask about a purchase, your month, savings or goals. It uses your live Gastos numbers plus everything under Memory.</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => setText(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col items-end gap-1">
                {pics(m).length > 0 && (
                  <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
                    {pics(m).map((n) => (
                      <a key={n} href={`/api/chat-images/${n}`} target="_blank" rel="noreferrer">
                        <img src={`/api/chat-images/${n}`} alt="Attached image" className="h-28 w-28 rounded-xl border border-line object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.content && <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-4 py-2 text-sm">{m.content}</div>}
              </div>
            ) : (
              <div key={m.id} className="max-w-[92%] text-sm leading-relaxed">
                {m.status === "pending" ? (
                  <p className="text-muted">Thinking… <Elapsed since={m.createdAt} /> <span className="text-xs">(usually 20–60s)</span></p>
                ) : m.status === "error" ? (
                  <p className="text-bad">
                    {m.content}
                    {m.id === messages[messages.length - 1]?.id && (
                      <button type="button" className="btn btn-sm ml-2" disabled={pending} onClick={retry}>Try again</button>
                    )}
                  </p>
                ) : (
                  <>
                    <Markdown text={m.content} />
                    {logged(m).length > 0 && (
                      <ul className="mt-2 space-y-1 border-l-2 border-good pl-3 text-xs text-muted">
                        {logged(m).map((e, i) => (
                          <li key={i}>
                            <span className={`font-semibold ${e.skipped ? "text-bad" : "text-good"}`}>{e.skipped ? `Not logged (${e.skipped})` : "Logged"}</span> · {e.date} · {e.category} · {e.note || "(no note)"}
                            {e.amount > 0 && <> · <span className="num">{peso(e.amount)}</span></>}
                            {e.id && !e.skipped && <> · <a className="underline" href={`/transactions?month=${e.date.slice(0, 7)}&q=${encodeURIComponent(e.note)}`}>view</a></>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {changes(m).length > 0 && (
                      <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs text-muted">
                        {changes(m).map((c, i) => (
                          <li key={i}><span className="font-semibold">{VERB[c.action]}</span> · {c.topic}: {c.fact}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ),
          )}
        </div>
        <div className="border-t border-line p-3">
          {err && <p className="mb-2 text-sm text-bad">{err}</p>}
          {(attachments.length > 0 || preparing > 0) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="relative">
                  <img src={a.url} alt="Image to send" className="h-16 w-16 rounded-lg border border-line object-cover" />
                  <button type="button" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-bg" onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))} aria-label="Remove image">✕</button>
                </div>
              ))}
              {Array.from({ length: preparing }, (_, i) => <div key={i} className="h-16 w-16 animate-pulse rounded-lg border border-line bg-card-2" />)}
            </div>
          )}
          <div className="flex items-end gap-2">
            {canAttach && (
              <>
                <input
                  ref={picker}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) void attach(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button type="button" className="btn btn-ghost h-[2.75rem] px-2.5" onClick={() => picker.current?.click()} disabled={attachments.length + preparing >= MAX_IMAGES} title="Attach images" aria-label="Attach images">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" /></svg>
                </button>
              </>
            )}
            <textarea
              ref={input}
              className="field min-h-[2.75rem] flex-1 resize-none text-sm"
              rows={1}
              placeholder={waiting ? "Waiting for the answer…" : "Ask about your money…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const files = canAttach ? [...e.clipboardData.files].filter((f) => f.type.startsWith("image/")) : [];
                if (!files.length) return;
                e.preventDefault();
                void attach(files);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
                  e.preventDefault();
                  if (canSend) send();
                }
              }}
            />
            <button type="button" className="btn btn-primary" disabled={!canSend} onClick={() => send()}>Send</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{touch ? "Tap Send when ready" : "Enter to send · Shift+Enter for a new line · paste or drop images"}</span>
            {messages.length > 0 &&
              (confirmClear ? (
                <span className="flex items-center gap-2">
                  Clear the conversation? Memory stays.
                  <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={clear}>Clear</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => setConfirmClear(true)}>Clear conversation</button>
              ))}
          </div>
        </div>
      </section>
      <MemoryPanel memory={memory} onChange={refresh} className={`min-h-0 flex-1 ${view === "memory" ? "flex" : "hidden"}`} />
    </>
  );
}

function MemoryPanel({ memory, onChange, className = "" }: { memory: MemoryFact[]; onChange: () => Promise<void>; className?: string }) {
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [topic, setTopic] = useState("");
  const [fact, setFact] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, MemoryFact[]>();
    for (const f of memory) {
      if (q && !`${f.topic} ${f.fact}`.toLowerCase().includes(q)) continue;
      map.set(f.topic, [...(map.get(f.topic) ?? []), f]);
    }
    return [...map.entries()];
  }, [memory, filter]);

  useEffect(() => {
    if (typeof editing === "number" && !groups.some(([, fs]) => fs.some((f) => f.id === editing))) setEditing(null);
  }, [groups, editing]);

  function edit(f: MemoryFact | null) {
    setErr(null);
    setEditing(f ? f.id : "new");
    setTopic(f?.topic ?? "");
    setFact(f?.fact ?? "");
  }

  function save() {
    start(async () => {
      const res = editing === "new" ? await addFact(topic, fact) : await updateFact(editing, topic, fact);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setEditing(null);
      await onChange();
    });
  }

  function remove(id: number) {
    start(async () => {
      await deleteFact(id);
      if (editing === id) setEditing(null);
      await onChange();
    });
  }

  const form = (
    <div className="space-y-2 rounded-lg border border-line p-2">
      <input className="field py-1 text-sm" placeholder="Topic (e.g. Emergency fund)" value={topic} onChange={(e) => setTopic(e.target.value)} list="memory-topics" />
      <textarea className="field text-sm" rows={3} placeholder="The fact, dated if it changes over time" value={fact} onChange={(e) => setFact(e.target.value)} autoFocus />
      {err && <p className="text-xs text-bad">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !fact.trim()} onClick={save}>Save</button>
      </div>
    </div>
  );

  return (
    <section className={`card flex-col p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Memory <span className="num text-sm font-normal text-muted">{memory.length}</span></h2>
        <button type="button" className="btn btn-sm" onClick={() => edit(null)}>+ Add</button>
      </div>
      <input className="field mb-3 py-1 text-sm" placeholder="Search memory" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <datalist id="memory-topics">{[...new Set([...TOPICS, ...memory.map((m) => m.topic)])].map((t) => <option key={t} value={t} />)}</datalist>
      {editing === "new" && <div className="mb-3">{form}</div>}
      <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 text-sm">
        {groups.length === 0 && <p className="text-muted">{memory.length ? "Nothing matches." : "Nothing remembered yet."}</p>}
        {groups.map(([t, facts]) => (
          <div key={t}>
            <div className="label mb-1">{t}</div>
            <ul className="space-y-1">
              {facts.map((f) =>
                editing === f.id ? (
                  <li key={f.id}>{form}</li>
                ) : (
                  <li key={f.id} className="group flex items-start gap-1 rounded-md px-1 py-0.5 hover:bg-card-2">
                    <button type="button" className="flex-1 text-left" onClick={() => edit(f)} title="Edit">{f.fact}</button>
                    <button type="button" className="text-muted opacity-60 hover:text-bad hover:opacity-100" onClick={() => remove(f.id)} disabled={pending} aria-label="Forget this fact">✕</button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
