"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BuildupRow, ChainResult } from "@/lib/market/engine";
import { INDICES } from "@/lib/market/universe";
import { fmtIN } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { LineSeries } from "@/components/charts/series";
import { OIProfile } from "@/components/charts/oiprofile";
import { Gauge } from "@/components/charts/gauge";
import { VBars } from "@/components/charts/vbars";
import { QuadrantTable } from "@/components/quadrant-table";
import { Card, CardHeader, Chip, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AnalyticsResp {
  pcrIntraday: { t: string; pcr: number }[];
  maxPainSeries: { label: string; dte: number; maxPain: number; spot: number }[];
  buildup: BuildupRow[];
}

const RANGE = 9; // strikes each side of ATM

function AnalyticsInner() {
  const sp = useSearchParams();
  const [symbol, setSymbol] = useState(sp.get("symbol")?.toUpperCase() ?? "NIFTY");
  useEffect(() => {
    const s = sp.get("symbol");
    if (s && s.toUpperCase() !== symbol) setSymbol(s.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const chain = usePolling<ChainResult>(`/api/market/chain?symbol=${symbol}`, 20000);
  const extra = usePolling<AnalyticsResp>(`/api/market/analytics?symbol=${symbol}`, 25000);

  const profileRows = useMemo(() => {
    if (!chain.data) return { oi: [], chg: [] };
    const atmIdx = chain.data.strikes.findIndex((s) => s.strike === chain.data!.atm);
    const lo = Math.max(atmIdx - RANGE, 0);
    const hi = Math.min(atmIdx + RANGE + 1, chain.data.strikes.length);
    const slice = chain.data.strikes.slice(lo, hi);
    return {
      oi: slice.map((s) => ({ strike: s.strike, ce: s.ce.oi, pe: s.pe.oi })),
      chg: slice.map((s) => ({ strike: s.strike, ce: s.ce.chgOi, pe: s.pe.chgOi })),
    };
  }, [chain.data]);

  const smile = useMemo(() => {
    if (!chain.data) return { xs: [], ys: [] };
    const atmIdx = chain.data.strikes.findIndex((s) => s.strike === chain.data!.atm);
    const lo = Math.max(atmIdx - 8, 0);
    const hi = Math.min(atmIdx + 9, chain.data.strikes.length);
    const slice = chain.data.strikes.slice(lo, hi);
    return {
      xs: slice.map((s) => (s.strike === chain.data!.atm ? "ATM" : `${s.strike}`)),
      ys: slice.map((s) => Number(((s.ce.iv + s.pe.iv) / 2).toFixed(2))),
    };
  }, [chain.data]);

  return (
    <div className="space-y-4 animate-rise">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-panel p-0.5 shadow-card">
          {INDICES.map((i) => (
            <button
              key={i.symbol}
              onClick={() => setSymbol(i.symbol)}
              className={cn(
                "rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-semibold transition-all",
                symbol === i.symbol ? "bg-brand text-white shadow-sm" : "text-faint hover:text-sub"
              )}
            >
              {i.symbol}
            </button>
          ))}
        </div>
        {chain.data && (
          <span className="num text-[12px] font-semibold text-sub">
            {chain.data.name} · {chain.data.expiryLabel} expiry · spot{" "}
            <span className="text-ink">{fmtIN(chain.data.spot)}</span>
          </span>
        )}
        <span className="ml-auto"><Chip tone="flat">ATM ± {RANGE} strikes</Chip></span>
      </div>

      {/* OI profiles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open interest by strike" sub="Where writers are positioned — calls left, puts right" right={<Chip tone="flat">Contracts</Chip>} />
          <div className="p-4">
            {chain.data ? (
              <OIProfile rows={profileRows.oi} atm={chain.data.atm} supports={chain.data.supports} resistances={chain.data.resistances} />
            ) : (
              <Skeleton className="h-[360px]" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Change in OI today" sub="Fresh writing vs unwinding through the session" right={<Chip tone="flat">Δ contracts</Chip>} />
          <div className="p-4">
            {chain.data ? (
              <OIProfile rows={profileRows.chg} atm={chain.data.atm} supports={chain.data.supports} resistances={chain.data.resistances} mode="chg" />
            ) : (
              <Skeleton className="h-[360px]" />
            )}
            <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-faint">
              Green = OI added, red = OI shed. Heavy call-side additions above spot signal supply; put-side additions below signal defended support.
            </p>
          </div>
        </Card>
      </div>

      {/* smile + gauges + pcr */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="IV smile"
            sub="Implied volatility across strikes — skew shows demand for protection"
            right={chain.data ? <Chip tone="brand">ATM IV {chain.data.atmIv}%</Chip> : null}
          />
          <div className="p-4">
            {smile.xs.length ? (
              <LineSeries xs={smile.xs} ys={smile.ys} height={210} dots area={false} yFmt={(n) => `${n.toFixed(1)}%`} />
            ) : (
              <Skeleton className="h-[210px]" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Positioning gauges" sub="Regime read at a glance" />
          <div className="grid grid-cols-2 gap-2 p-4">
            {chain.data ? (
              <>
                <div>
                  <Gauge
                    value={chain.data.pcrOi}
                    min={0.4}
                    max={2.2}
                    display={String(chain.data.pcrOi)}
                    sub="PCR (OI)"
                    zones={[
                      { to: (0.75 - 0.4) / 1.8, color: "var(--color-down)", label: "" },
                      { to: (1.35 - 0.4) / 1.8, color: "var(--color-up)", label: "" },
                      { to: 1, color: "var(--color-warn)", label: "" },
                    ]}
                  />
                  <p className="mt-1 text-center text-[10px] font-medium text-faint">
                    {chain.data.pcrOi < 0.75 ? "Call-heavy" : chain.data.pcrOi > 1.35 ? "Put-heavy" : "Balanced"}
                  </p>
                </div>
                <div>
                  <Gauge
                    value={chain.data.ivr}
                    min={0}
                    max={100}
                    display={String(chain.data.ivr)}
                    sub="IV Rank"
                    zones={[
                      { to: 0.3, color: "var(--color-up)", label: "" },
                      { to: 0.65, color: "var(--color-warn)", label: "" },
                      { to: 1, color: "var(--color-down)", label: "" },
                    ]}
                  />
                  <p className="mt-1 text-center text-[10px] font-medium text-faint">
                    {chain.data.ivr < 30 ? "Premium cheap" : chain.data.ivr > 65 ? "Premium rich" : "Mid-range"}
                  </p>
                </div>
              </>
            ) : (
              <Skeleton className="col-span-2 h-[130px]" />
            )}
          </div>
          <div className="mx-4 mb-4 rounded-lg border border-line bg-paper/60 p-3 text-[11px] leading-relaxed text-sub">
            {chain.data
              ? chain.data.ivr >= 60 && chain.data.pcrOi > 0.9
                ? "Rich premium with balanced positioning — statistically a premium-seller's tape. Prefer defined-risk short structures."
                : chain.data.ivr <= 30
                  ? "Cheap premium — selling options here pays poorly for the tail risk. Debit structures keep better odds."
                  : "No strong volatility edge. Let price and OI walls drive structure choice."
              : ""}
          </div>
        </Card>
      </div>

      {/* pcr intraday + max pain */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Put-Call ratio · intraday path" sub="Session evolution of OI PCR" right={<Chip tone="warn">reference 1.00</Chip>} />
          <div className="p-4">
            {extra.data?.pcrIntraday?.length ? (
              <LineSeries
                xs={extra.data.pcrIntraday.map((p) => p.t)}
                ys={extra.data.pcrIntraday.map((p) => p.pcr)}
                height={190}
                refLine={1}
                refLabel="parity"
                color="var(--color-brand)"
              />
            ) : (
              <Skeleton className="h-[190px]" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Max pain vs spot · by expiry" sub="Distance of pin level from spot (%) for the next expiries" />
          <div className="p-4">
            {extra.data?.maxPainSeries?.length ? (
              <VBars
                items={extra.data.maxPainSeries.map((m) => ({
                  label: m.label,
                  sub: `${m.dte}d · MP ${fmtIN(m.maxPain, 0)}`,
                  value: Number((((m.maxPain - m.spot) / m.spot) * 100).toFixed(2)),
                }))}
                height={190}
                format={(n) => `${n.toFixed(2)}%`}
              />
            ) : (
              <Skeleton className="h-[190px]" />
            )}
          </div>
        </Card>
      </div>

      {/* full quadrant */}
      <Card>
        <CardHeader title="Futures OI build-up · all contracts" sub="Index + stock futures across quadrants, sorted by OI change magnitude" />
        <div className="pb-2">{extra.data ? <QuadrantTable rows={extra.data.buildup} /> : <Skeleton className="m-4 h-[420px]" />}</div>
      </Card>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <AnalyticsInner />
    </Suspense>
  );
}
