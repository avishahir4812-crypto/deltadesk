"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChartColumn,
  FilePlus2,
  FlaskConical,
  LayoutGrid,
  NotebookPen,
  Search,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { setPaletteOpen, usePaletteOpen } from "@/lib/hooks";
import { ALL, INDICES } from "@/lib/market/universe";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: typeof LayoutGrid;
  action: () => void;
}

export default function CommandPalette() {
  const open = usePaletteOpen();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: Item[] = useMemo(() => {
    const close = () => setPaletteOpen(false);
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    return [
      { id: "ov", group: "Pages", label: "Market Overview", icon: LayoutGrid, action: go("/") },
      { id: "ch", group: "Pages", label: "Option Chain", icon: Waypoints, action: go("/chain") },
      { id: "an", group: "Pages", label: "Derivatives Analytics", icon: ChartColumn, action: go("/analytics") },
      { id: "st", group: "Pages", label: "Strategy Lab", icon: FlaskConical, action: go("/strategy") },
      { id: "ai", group: "Pages", label: "AI Research Copilot", icon: Sparkles, action: go("/research") },
      { id: "nt", group: "Pages", label: "Desk Notes", icon: NotebookPen, action: go("/notes") },
      ...INDICES.map<Item>((i) => ({
        id: `chain-${i.symbol}`,
        group: "Open option chain",
        label: `${i.name} chain`,
        hint: i.symbol,
        icon: Waypoints,
        action: go(`/chain?symbol=${i.symbol}`),
      })),
      ...ALL.map<Item>((i) => ({
        id: `strat-${i.symbol}`,
        group: "Strategy lab on",
        label: `Price a strategy · ${i.name}`,
        hint: i.symbol,
        icon: FlaskConical,
        action: go(`/strategy?symbol=${i.symbol}`),
      })),
      { id: "ask", group: "Actions", label: "Ask the research copilot…", icon: Sparkles, action: go("/research?focus=1") },
      { id: "new-note", group: "Actions", label: "New desk note", icon: FilePlus2, action: go("/notes?new=1") },
    ];
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const out: { name: string; rows: { item: Item; idx: number }[] }[] = [];
    filtered.forEach((item, idx) => {
      let g = out.find((x) => x.name === item.group);
      if (!g) {
        g = { name: item.group, rows: [] };
        out.push(g);
      }
      g.rows.push({ item, idx });
    });
    return out;
  }, [filtered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!open);
      } else if (e.key === "Escape" && open) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/25 pt-[13vh] backdrop-blur-[3px] animate-fade"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel shadow-pop animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                filtered[cursor]?.action();
              }
            }}
            placeholder="Type a command or search instruments…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-faint">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
          {groups.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-faint">No matches. Try “NIFTY chain” or “strategy”.</p>
          )}
          {groups.map((g) => (
            <div key={g.name}>
              <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{g.name}</p>
              {g.rows.map(({ item, idx }) => (
                <button
                  key={item.id}
                  data-idx={idx}
                  onMouseEnter={() => setCursor(idx)}
                  onClick={item.action}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left text-[13px]",
                    idx === cursor ? "bg-brand-soft text-brand-deep" : "text-ink"
                  )}
                >
                  {item.icon ? <item.icon size={15} className={idx === cursor ? "text-brand" : "text-faint"} /> : null}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.hint ? <span className="num text-[10.5px] font-semibold text-faint">{item.hint}</span> : null}
                  {idx === cursor ? <ArrowUpRight size={14} className="text-brand" /> : null}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-paper px-4 py-2 text-[10.5px] font-medium text-faint">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span className="ml-auto">DeltaDesk quick actions</span>
        </div>
      </div>
    </div>
  );
}
