"use client";

import { Fragment, useEffect, useRef } from "react";
import type { ChainResult } from "@/lib/market/engine";
import { fmtIN, fmtOi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

function OiCell({
  value,
  max,
  align,
  itm,
  className,
}: {
  value: number;
  max: number;
  align: "left" | "right";
  itm: boolean;
  className?: string;
}) {
  return (
    <td className={cn("relative px-2 py-[5px] text-right", className)}>
      <span
        className={cn("absolute inset-y-[3px] rounded-[3px]", align === "right" ? "right-1" : "left-1")}
        style={{
          width: `${Math.max((value / max) * 96, 2)}%`,
          background: align === "right" ? "rgba(210,58,44,0.10)" : "rgba(10,125,88,0.10)",
        }}
      />
      <span className="num relative text-[11.5px] font-medium">{fmtOi(value)}</span>
      {itm && <span className={cn("absolute inset-y-0 w-[2px]", align === "right" ? "left-0" : "right-0", "bg-line2/0")} />}
    </td>
  );
}

function ChgCell({ value, className }: { value: number; className?: string }) {
  return (
    <td className={cn("num px-2 py-[5px] text-right text-[11px] font-semibold", value > 0 ? "text-up" : value < 0 ? "text-down" : "text-faint", className)}>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {fmtOi(Math.abs(value))}
    </td>
  );
}

export function ChainTable({ data, showGreeks }: { data: ChainResult; showGreeks: boolean }) {
  const atmRef = useRef<HTMLTableRowElement>(null);
  const scrollKey = `${data.symbol}:${data.expiry}`;

  useEffect(() => {
    atmRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [scrollKey]);

  const maxCe = Math.max(...data.strikes.map((s) => s.ce.oi), 1);
  const maxPe = Math.max(...data.strikes.map((s) => s.pe.oi), 1);
  const [loBound, hiBound] = data.spotBetween;

  const thCls = "border-b border-line px-2 py-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint";
  const midCols = showGreeks ? (
    <>
      <th className={cn(thCls, "text-right")}>Theta</th>
      <th className={cn(thCls, "text-right")}>Delta</th>
    </>
  ) : (
    <>
      <th className={cn(thCls, "text-right")}>IV</th>
      <th className={cn(thCls, "text-right")}>Volume</th>
    </>
  );

  return (
    <div className="max-h-[640px] overflow-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#fbfaf6]">
            <th colSpan={5} className={cn(thCls, "text-center text-down/80")}>CALLS</th>
            <th className={cn(thCls, "border-x text-center")}>Strike</th>
            <th colSpan={5} className={cn(thCls, "text-center text-up/80")}>PUTS</th>
          </tr>
          <tr className="bg-[#fbfaf6]">
            <th className={cn(thCls, "text-right")}>OI</th>
            <th className={cn(thCls, "text-right")}>Chg OI</th>
            {midCols}
            <th className={cn(thCls, "border-r text-right")}>LTP</th>
            <th className={cn(thCls, "border-r text-center")}>ATM ±</th>
            <th className={cn(thCls, "text-right")}>LTP</th>
            {midCols}
            <th className={cn(thCls, "text-right")}>Chg OI</th>
            <th className={cn(thCls, "text-right")}>OI</th>
          </tr>
        </thead>
        <tbody>
          {data.strikes.map((row) => {
            const isAtm = row.strike === data.atm;
            const ceItm = row.strike < data.spot;
            const peItm = row.strike > data.spot;
            const markerAfter = row.strike === loBound && loBound !== hiBound;
            return (
              <Fragment key={row.strike}>
                <tr
                  ref={isAtm ? atmRef : undefined}
                  className={cn("group transition-colors hover:bg-brand-soft/30", isAtm && "bg-brand-soft/40")}
                >
                  <OiCell value={row.ce.oi} max={maxCe} align="right" itm={ceItm} className={cn(ceItm && "bg-up-soft/30")} />
                  <ChgCell value={row.ce.chgOi} className={cn(ceItm && "bg-up-soft/30")} />
                  {showGreeks ? (
                    <>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", ceItm && "bg-up-soft/30")}>{fmtIN(row.ce.theta, 1)}</td>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", ceItm && "bg-up-soft/30")}>{row.ce.delta.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", ceItm && "bg-up-soft/30")}>{fmtIN(row.ce.iv, 1)}</td>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", ceItm && "bg-up-soft/30")}>{fmtOi(row.ce.vol)}</td>
                    </>
                  )}
                  <td className={cn("num border-r border-line px-2 py-[5px] text-right text-[11.5px] font-semibold", ceItm && "bg-up-soft/30")}>
                    {fmtIN(row.ce.ltp)}
                  </td>

                  <td className={cn("border-x border-line px-1 py-[5px] text-center")}>
                    <span
                      className={cn(
                        "num inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        isAtm ? "bg-brand text-white" : "text-ink"
                      )}
                    >
                      {row.strike.toLocaleString("en-IN")}
                    </span>
                  </td>

                  <td className={cn("num px-2 py-[5px] text-right text-[11.5px] font-semibold", peItm && "bg-down-soft/25")}>{fmtIN(row.pe.ltp)}</td>
                  {showGreeks ? (
                    <>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", peItm && "bg-down-soft/25")}>{fmtIN(row.pe.theta, 1)}</td>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", peItm && "bg-down-soft/25")}>{row.pe.delta.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className={cn("num border-l border-line px-2 py-[5px] text-right text-[11px] text-sub", peItm && "bg-down-soft/25")}>{fmtIN(row.pe.iv, 1)}</td>
                      <td className={cn("num px-2 py-[5px] text-right text-[11px] text-sub", peItm && "bg-down-soft/25")}>{fmtOi(row.pe.vol)}</td>
                    </>
                  )}
                  <ChgCell value={row.pe.chgOi} className={cn(peItm && "bg-down-soft/25")} />
                  <OiCell value={row.pe.oi} max={maxPe} align="left" itm={peItm} className={cn(peItm && "bg-down-soft/25")} />
                </tr>

                {markerAfter && (
                  <tr>
                    <td colSpan={11} className="relative py-0">
                      <div className="flex items-center gap-2 px-2 py-[3px]">
                        <span className="h-px flex-1 border-t border-dashed border-brand/50" />
                        <span className="num inline-flex items-center gap-1 rounded-full bg-brand px-2 py-[2px] text-[10px] font-bold text-white">
                          {data.chgPct >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          Spot {fmtIN(data.spot)}
                        </span>
                        <span className="h-px flex-1 border-t border-dashed border-brand/50" />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-line bg-paper/60 px-3 py-2 text-[10.5px] text-faint">
        <span>
          Rows shaded = ITM. <b className="text-down/80">Red backdrop: Call OI</b> · <b className="text-up/80">Green backdrop: Put OI</b>
        </span>
        <span className="num">As of {data.asOf}</span>
      </div>
    </div>
  );
}
