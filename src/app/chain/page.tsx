"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { ChainResult } from "@/lib/market/engine";
import { INDICES, STOCKS } from "@/lib/market/universe";
import { fmtIN, fmtOi } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { ChainTable } from "@/components/chain-table";
import { Btn, Card, CardHeader, Chip, Segmented, Select, Skeleton, Stat } from "@/components/ui";
import { DeltaChip } from "@/components/number";
import { cn } from "@/lib/utils";

function ChainInner() {
  const sp = useSearchParams();
  const [symbol, setSymbol] = useState(sp.get("symbol")?.toUpperCase() ?? "NIFTY");
  const [expiry, setExpiry] = useState<string | null>(null);
  const [greeks, setGreeks] = useState(false);
  const [depth, setDepth] = useState<string>("18");

  useEffect(() => {
    const s = sp.get("symbol");
    if (s && s.toUpperCase() !== symbol) {
      setSymbol(s.toUpperCase());
      setExpiry(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const url = `/api/market/chain?symbol=${symbol}${expiry ? `&expiry=${expiry}` : ""}`;
  const { data, loading, refresh, updatedAt } = usePolling<ChainResult>(url, 15000);

  const sliced = useMemo(() => {
    if (!data) return null;
    if (depth === "All") return data;
    const n = Number(depth);
    const atmIdx = data.strikes.findIndex((s) => s.strike === data.atm);
    const lo = Math.max(atmIdx - n, 0);
    const hi = Math.min(atmIdx + n + 1, data.strikes.length);
    return { ...data, strikes: data.strikes.slice(lo, hi) };
  }, [data, depth]);

  return (
    <div className="space-y-4 animate-rise">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={symbol} onChange={(e) => { setSymbol(e.target.value); setExpiry(null); }} className="min-w-[190px]">
          <optgroup label="Indices">
            {INDICES.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}
          </optgroup>
          <optgroup label="F&O Stocks">
            {STOCKS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}
          </optgroup>
        </Select>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {data?.expiries.map((e) => (
            <button
              key={e.key + e.kind}
              onClick={() => setExpiry(e.key)}
              className={cn(
                "whitespace-nowrap rounded-lg border px-2.5 py-[7px] text-[11.5px] font-semibold transition-all",
                (expiry ?? data.expiries[0]?.key) === e.key
                  ? "border-brand bg-brand-soft text-brand-deep shadow-card"
                  : "border-line bg-panel text-faint hover:border-faint hover:text-sub"
              )}
            >
              {e.label}
              <span className={cn("num ml-1.5 rounded px-1 text-[9px] font-bold", (expiry ?? data.expiries[0]?.key) === e.key ? "bg-brand text-white" : "bg-[#efeee9] text-faint")}>
                {e.dte}d
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Segmented
            options={[
              { value: "pricing" as const, label: "Pricing" },
              { value: "greeks" as const, label: "Greeks" },
            ]}
            value={greeks ? "greeks" : "pricing"}
            onChange={(v) => setGreeks(v === "greeks")}
          />
          <Select value={depth} onChange={(e) => setDepth(e.target.value)} className="h-9 w-[108px] text-[12px]" title="Strikes around ATM">
            <option value="12">±12 strikes</option>
            <option value="18">±18 strikes</option>
            <option value="All">All strikes</option>
          </Select>
          <Btn variant="outline" size="md" onClick={() => refresh()} title="Refresh chain">
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </Btn>
        </div>
      </div>

      {/* KPI strip */}
      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-3 xl:grid-cols-6">
        {data ? (
          <>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">{data.name}</p>
              <div className="num mt-1 text-[19px] font-semibold leading-none">{fmtIN(data.spot)}</div>
              <div className="mt-1.5"><DeltaChip pct={data.chgPct} /></div>
            </div>
            <Stat
              label="Max Pain"
              value={fmtIN(data.maxPain, 0)}
              sub={`${data.maxPain >= data.spot ? "+" : ""}${(((data.maxPain - data.spot) / data.spot) * 100).toFixed(2)}% vs spot`}
              tone={data.maxPain >= data.spot ? "up" : "down"}
              hint="Settlement level minimising payout to option buyers"
            />
            <Stat label="PCR · OI" value={data.pcrOi} sub={`Volume PCR ${data.pcrVol}`} tone={data.pcrOi >= 1 ? "up" : "warn"} hint="Put OI / Call OI across displayed strikes" />
            <Stat label="ATM IV" value={`${data.atmIv}%`} sub={`IV Rank ${data.ivr} / 100`} tone={data.ivr >= 60 ? "warn" : "flat"} hint="Implied vol at the money; IVR = rank vs last 30 sessions" />
            <Stat label="ATM Straddle" value={fmtIN(data.straddle)} sub={`±${data.expectedMovePct}% expected`} hint="CE+PE premium at ATM — the market's priced move" />
            <Stat
              label={`PE OI · ${data.expiryLabel}`}
              value={`${fmtOi(data.totPeOi)}`}
              sub={`vs CE OI ${fmtOi(data.totCeOi)}`}
              hint="Aggregate put open interest vs call open interest for this expiry"
            />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)
        )}
      </Card>

      {/* levels + reads */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="font-semibold text-faint">OI walls:</span>
          {data.resistances.slice().reverse().map((r, i) => (
            <Chip key={`r${r}`} tone="down" className="tip cursor-help" data-tip={`Call OI wall · resistance ${i === 1 ? "1 (primary)" : "2"}`}>
              R{data.resistances.length - i} {fmtIN(r, 0)}
            </Chip>
          ))}
          <Chip tone="brand">Spot {fmtIN(data.spot, 0)}</Chip>
          {data.supports.map((s, i) => (
            <Chip key={`s${s}`} tone="up" className="tip cursor-help" data-tip={`Put OI wall · support ${i + 1}`}>
              S{i + 1} {fmtIN(s, 0)}
            </Chip>
          ))}
          <span className="ml-auto hidden items-center gap-2 text-faint lg:flex">
            <span className="text-up font-semibold">Put writers {data.pcrOi >= 1 ? "in control" : "defensive"}</span>
            <span>·</span>
            <span>Chain updates every 15s</span>
          </span>
        </div>
      )}

      {/* table */}
      <Card>
        <CardHeader
          title="Strike ladder"
          sub={data ? `${data.exch} · lot ${data.lot} · ${data.expiryLabel} expiry (${data.dte}d)` : "Loading chain…"}
          right={data ? <Chip tone="flat">ATM {fmtIN(data.atm, 0)}</Chip> : null}
        />
        {sliced ? <ChainTable data={sliced} showGreeks={greeks} /> : <Skeleton className="m-4 h-[480px]" />}
      </Card>
    </div>
  );
}

export default function ChainPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <ChainInner />
    </Suspense>
  );
}
