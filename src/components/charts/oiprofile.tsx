"use client";

import { fmtOi } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ProfileRow {
  strike: number;
  ce: number;
  pe: number;
}

const CallRed = "rgba(210, 58, 44, 0.72)";
const PutGreen = "rgba(10, 125, 88, 0.72)";

/** Centered strike ladder: Call OI to the left, Put OI to the right. */
export function OIProfile({
  rows,
  atm,
  supports,
  resistances,
  mode = "oi",
}: {
  rows: ProfileRow[];
  atm: number;
  supports: number[];
  resistances: number[];
  mode?: "oi" | "chg";
}) {
  const max = Math.max(...rows.map((r) => Math.max(Math.abs(r.ce), Math.abs(r.pe))), 1);
  const signed = mode === "chg";

  const bar = (v: number, side: "ce" | "pe") => {
    const pct = Math.max((Math.abs(v) / max) * 100, v === 0 ? 0 : 1.5);
    const color = signed ? (v >= 0 ? PutGreen : CallRed) : side === "ce" ? CallRed : PutGreen;
    return (
      <div className={cn("h-full rounded-[3px]", side === "pe" && "ml-auto")} style={{ width: `${pct}%`, background: color }} />
    );
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center text-[9.5px] font-bold uppercase tracking-[0.12em] text-faint">
        <span className="flex-1 text-right">Calls</span>
        <span className="w-20 text-center">Strike</span>
        <span className="flex-1">Puts</span>
      </div>
      <div className="space-y-[3px]">
        {rows.map((r) => {
          const isAtm = r.strike === atm;
          const isR = resistances[0] === r.strike;
          const isS = supports[0] === r.strike;
          return (
            <div key={r.strike} className={cn("group flex h-[17px] items-center rounded-[4px]", isAtm && "bg-brand-soft/60")}>
              <div className="flex h-full flex-1 items-center justify-end">
                <span className="num pr-1.5 text-[9.5px] font-semibold text-sub opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtOi(r.ce)}
                </span>
                <div className="h-[11px] w-full max-w-full">{bar(r.ce, "ce")}</div>
              </div>
              <div className={cn("num w-20 shrink-0 text-center text-[10.5px] font-semibold", isAtm ? "text-brand-deep" : "text-sub")}>
                {r.strike.toLocaleString("en-IN")}
              </div>
              <div className="flex h-full flex-1 items-center">
                <div className="h-[11px] w-full">{bar(r.pe, "pe")}</div>
                <span className="num pl-1.5 text-[9.5px] font-semibold text-sub opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtOi(r.pe)}
                </span>
              </div>
              <div className="flex w-8 shrink-0 items-center gap-1 pl-1">
                {isR && <span className="rounded bg-down-soft px-1 text-[8.5px] font-bold text-down">R</span>}
                {isS && <span className="rounded bg-up-soft px-1 text-[8.5px] font-bold text-up">S</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
