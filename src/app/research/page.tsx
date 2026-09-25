"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, CalendarClock, SendHorizonal, Sparkles } from "lucide-react";
import type { AiCard } from "@/lib/ai/engine";
import type { Brief } from "@/lib/ai/brief";
import { formatDayKey } from "@/lib/market/time";
import { usePolling } from "@/lib/hooks";
import { Btn, Card, CardHeader, Chip, Input, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  cards?: AiCard[];
}

const SUGGESTIONS = [
  "Summarise today's market",
  "Where is NIFTY support and resistance?",
  "Is premium selling attractive today?",
  "Suggest a strategy for BANKNIFTY",
  "Top OI build-ups right now",
  "Explain max pain",
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Good to have you at the desk. I read the live option chain, futures OI and volatility state — ask me for a **market summary**, **support/resistance levels**, **strategy ideas**, or to **explain any F&O concept** with live numbers.",
  cards: [],
};

/* markdown-lite renderer: **bold**, "- " bullets, paragraphs */
function md(text: string): ReactNode {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  const boldify = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((p, j) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <b key={j} className="font-semibold text-ink">{p.slice(2, -2)}</b>
        ) : (
          p
        )
      );
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="space-y-1.5">
          {items.map((it, k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span>{boldify(it)}</span>
            </li>
          ))}
        </ul>
      );
    } else if (ln.trim() === "") {
      i++;
    } else {
      blocks.push(<p key={key++}>{boldify(ln)}</p>);
      i++;
    }
  }
  return <div className="space-y-2.5">{blocks}</div>;
}

function CardGrid({ cards }: { cards?: AiCard[] }) {
  if (!cards?.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {cards.map((c, i) => (
        <div key={i} className="rounded-lg border border-line bg-paper/70 px-2.5 py-2">
          <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.08em] text-faint">{c.label}</p>
          <p
            className={cn(
              "num mt-0.5 truncate text-[13px] font-bold",
              c.tone === "up" && "text-up",
              c.tone === "down" && "text-down",
              c.tone === "warn" && "text-warn",
              c.tone === "brand" && "text-brand"
            )}
          >
            {c.value}
          </p>
          {c.sub ? <p className="truncate text-[10px] text-faint">{c.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ResearchInner() {
  const sp = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const histLoaded = useRef(false);

  const brief = usePolling<{ brief?: Brief; archive: { day: string }[] }>("/api/ai/brief", 0);

  useEffect(() => {
    if (sp.get("focus")) setTimeout(() => inputRef.current?.focus(), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hydrate persisted history
  useEffect(() => {
    if (histLoaded.current) return;
    histLoaded.current = true;
    fetch("/api/ai/chat?session=default")
      .then((r) => r.json())
      .then((d: { messages?: { role: string; content: string; cards?: AiCard[] }[] }) => {
        if (d.messages?.length) {
          setMsgs([WELCOME, ...d.messages.map((m) => ({ role: m.role as Msg["role"], content: m.content, cards: m.cards }))]);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, sessionId: "default" }),
      });
      const out = (await res.json()) as { reply: string; cards: AiCard[] };
      // typewriter reveal
      setMsgs((m) => [...m, { role: "assistant", content: "", cards: [] }]);
      const full = out.reply;
      let shown = 0;
      const step = Math.max(4, Math.ceil(full.length / 90));
      const idx = msgs.length + 1;
      const timer = setInterval(() => {
        shown = Math.min(shown + step, full.length);
        setTyping(shown);
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: full.slice(0, shown), cards: shown >= full.length ? out.cards : [] };
          return copy;
        });
        if (shown >= full.length) {
          clearInterval(timer);
          setTyping(null);
          setBusy(false);
        }
      }, 18);
      void idx;
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "The copilot hit an error. Please try again." }]);
      setBusy(false);
    }
  };

  const sections = brief.data?.brief?.sections ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-3 animate-rise">
      {/* chat */}
      <Card className="flex min-h-[72vh] flex-col xl:col-span-2">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft text-brand"><Bot size={14} /></span>
              Research copilot
            </span>
          }
          sub="Grounded in the live chain · history persisted to Postgres"
          right={<Chip tone="brand">chain-aware</Chip>}
        />

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13px] leading-relaxed text-paper shadow-card">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand-line bg-brand-soft text-brand">
                  <Sparkles size={13} />
                </span>
                <div className="max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-md border border-line bg-panel px-4 py-3 text-[13px] leading-relaxed text-sub shadow-card">
                    {m.content ? md(m.content) : (
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-faint" />
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-faint" style={{ animationDelay: "0.2s" }} />
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-faint" style={{ animationDelay: "0.4s" }} />
                      </span>
                    )}
                    {typing !== null && i === msgs.length - 1 && <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse-dot bg-brand/70 align-middle" />}
                  </div>
                  <CardGrid cards={m.cards} />
                </div>
              </div>
            )
          )}
        </div>

        <div className="border-t border-line p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-medium text-sub transition-all hover:border-brand hover:bg-brand-soft/50 hover:text-brand-deep disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about levels, PCR, volatility, strategy…"
              className="h-10"
            />
            <Btn variant="solid" onClick={() => send(input)} disabled={busy || !input.trim()} className="h-10 w-10 shrink-0 !px-0">
              <SendHorizonal size={16} />
            </Btn>
          </div>
        </div>
      </Card>

      {/* brief */}
      <div className="space-y-4">
        <Card>
          <CardHeader title="Today's desk brief" sub="Auto-generated, persisted daily" right={<CalendarClock size={15} className="text-brand" />} />
          <div className="p-4">
            {brief.data?.brief ? (
              <>
                <p className="text-[12.5px] font-semibold leading-relaxed">{brief.data.brief.lead}</p>
                <div className="mt-3 space-y-1.5">
                  {sections.map((s, i) => (
                    <details key={i} className="group rounded-lg border border-line bg-paper/50 open:bg-panel" open={i < 2}>
                      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-semibold transition-colors hover:text-brand-deep [&::-webkit-details-marker]:hidden">
                        {s.heading}
                        <span className="text-faint transition-transform group-open:rotate-90">›</span>
                      </summary>
                      <ul className="space-y-1.5 px-3 pb-3 pt-0.5">
                        {s.bullets.map((b, j) => (
                          <li key={j} className="flex gap-2 text-[11.5px] leading-relaxed text-sub">
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-2"><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-full" /><Skeleton className="h-20 w-full" /></div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Brief archive" sub="One brief per trading session" />
          <div className="divide-y divide-line">
            {(brief.data?.archive ?? []).slice(0, 8).map((a) => (
              <div key={a.day} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[12px] font-medium">{formatDayKey(a.day, true)}</span>
                <Chip tone="flat">auto</Chip>
              </div>
            ))}
            {!brief.data && <Skeleton className="m-4 h-24" />}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] leading-relaxed text-faint">
            <b className="text-sub">How it works:</b> the copilot routes intent, pulls the same chain/futures
            state the terminal displays, then composes an answer — figures always match the screens. The brief
            is the artifact a scheduled automation (Vercel Cron / N8N) ships to a desk channel.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <ResearchInner />
    </Suspense>
  );
}
