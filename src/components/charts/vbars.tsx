"use client";

import { fmtIN } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface VBarItem {
  label: string;
  value: number;
  sub?: string;
}

/** Signed vertical bar strip (institutional flows, per-expiry deltas). */
export function VBars({
  items,
  height = 128,
  colorUp = "var(--color-up)",
  colorDown = "var(--color-down)",
  format,
}: {
  items: VBarItem[];
  height?: number;
  colorUp?: string;
  colorDown?: string;
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n) => fmtIN(n, 0));
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="flex items-stretch gap-2" style={{ height }}>
      {items.map((it, i) => {
        const h = Math.max((Math.abs(it.value) / max) * 100, 4);
        const up = it.value >= 0;
        return (
          <div key={i} className="group flex min-w-0 flex-1 flex-col items-center">
            <div className="num pb-1 text-[10px] font-semibold text-sub opacity-0 transition-opacity group-hover:opacity-100">
              {up ? "+" : "−"}{fmt(Math.abs(it.value))}
            </div>
            <div className="flex w-full flex-1 flex-col items-center justify-end">
              <div
                className={cn("w-full max-w-[38px] rounded-[5px] transition-all duration-300 group-hover:brightness-95")}
                style={{ height: `${h}%`, background: up ? colorUp : colorDown, opacity: 0.88 }}
              />
            </div>
            <div className="pt-1.5 text-center text-[9.5px] font-medium leading-tight text-faint">
              {it.label}
              {it.sub ? <div className="text-[8.5px] opacity-80">{it.sub}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
