"use client";

import { useMemo, useState } from "react";
import type { BuildupRow, BuildupClass } from "@/lib/market/engine";
import { fmtIN, fmtOi, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const CLASSES: (BuildupClass | "All")[] = ["All", "Long Buildup", "Short Buildup", "Short Covering", "Long Unwinding"];

const toneOf: Record<BuildupClass, string> = {
  "Long Buildup": "bg-up-soft text-up",
  "Short Buildup": "bg-down-soft text-down",
  "Short Covering": "bg-brand-soft text-brand",
  "Long Unwinding": "bg-warn-soft text-warn",
};

export function QuadrantTable({ rows, compact = false }: { rows: BuildupRow[]; compact?: boolean }) {
  const [filter, setFilter] = useState<(typeof CLASSES)[number]>("All");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.cls, (m.get(r.cls) ?? 0) + 1));
    return m;
  }, [rows]);

  const shown = filter === "All" ? rows : rows.filter((r) => r.cls === filter);
  const list = compact ? shown.slice(0, 8) : shown;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        {CLASSES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
              filter === c ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-panel text-faint hover:text-sub"
            )}
          >
            {c}
            <span className="num ml-1 opacity-70">{c === "All" ? rows.length : counts.get(c) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="mt-2 w-full">
          <thead>
            <tr className="border-y border-line bg-[#fbfaf6] text-left text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint">
              <th className="py-2 pl-4 pr-2">Instrument</th>
              <th className="px-2 py-2 text-right">Futures</th>
              <th className="px-2 py-2 text-right">Chg %</th>
              <th className="px-2 py-2 text-right">OI</th>
              <th className="px-2 py-2 text-right">OI Chg %</th>
              <th className="py-2 pl-2 pr-4 text-right">Signal</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const strength = Math.min(Math.abs(r.chgPct) * Math.abs(r.oiChgPct), 25);
              return (
                <tr key={r.symbol} className="border-b border-line/70 transition-colors last:border-0 hover:bg-paper/70">
                  <td className="py-2.5 pl-4 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold">{r.symbol}</span>
                      <span className={cn("rounded px-1 py-px text-[9px] font-bold uppercase", r.kind === "index" ? "bg-brand-soft text-brand" : "bg-[#efeee9] text-faint")}>
                        {r.kind === "index" ? "idx" : "stk"}
                      </span>
                    </div>
                    <div className="max-w-[150px] truncate text-[10.5px] text-faint">{r.name}</div>
                  </td>
                  <td className="num px-2 py-2.5 text-right text-[12px] font-medium">{fmtIN(r.fut)}</td>
                  <td className={cn("num px-2 py-2.5 text-right text-[12px] font-semibold", r.chgPct >= 0 ? "text-up" : "text-down")}>
                    {fmtPct(r.chgPct)}
                  </td>
                  <td className="num px-2 py-2.5 text-right text-[12px] text-sub">{fmtOi(r.oi)}</td>
                  <td className={cn("num px-2 py-2.5 text-right text-[12px] font-semibold", r.oiChgPct >= 0 ? "text-up" : "text-down")}>
                    {fmtPct(r.oiChgPct)}
                  </td>
                  <td className="py-2.5 pl-2 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-[3px] w-10 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn("h-full rounded-full", r.cls === "Long Buildup" ? "bg-up" : r.cls === "Short Buildup" ? "bg-down" : r.cls === "Short Covering" ? "bg-brand" : "bg-warn")}
                          style={{ width: `${(strength / 25) * 100}%` }}
                        />
                      </div>
                      <span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold", toneOf[r.cls])}>{r.cls}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-faint">No contracts in this quadrant right now.</p>}
    </div>
  );
}
