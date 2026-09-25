"use client";

import { useEffect, useRef, useState } from "react";
import { fmtIN, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Numeric value that flashes green/red when it changes across polls. */
export function Num({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), 800);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <span
      className={cn(
        "num rounded px-0.5 -mx-0.5 transition-colors",
        flash === "up" && "animate-flash-up",
        flash === "down" && "animate-flash-down",
        className
      )}
    >
      {(format ?? ((n) => fmtIN(n)))(value)}
    </span>
  );
}

export function DeltaChip({ pct, abs, className }: { pct: number; abs?: number; className?: string }) {
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold",
        pct > 0 && "bg-up-soft text-up",
        pct < 0 && "bg-down-soft text-down",
        pct === 0 && "bg-[#efeee9] text-sub",
        className
      )}
    >
      <Icon size={13} strokeWidth={2.4} />
      {fmtPct(pct)}
      {abs !== undefined ? <span className="opacity-70">· {fmtIN(Math.abs(abs), 1)}</span> : null}
    </span>
  );
}
