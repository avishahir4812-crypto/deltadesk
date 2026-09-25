"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ListPlus, Sparkles, X } from "lucide-react";
import type { BuildupRow, Candle } from "@/lib/market/engine";
import type { Brief } from "@/lib/ai/brief";
import { ALL, INDICES } from "@/lib/market/universe";
import { fmtIN, fmtPct, fmtCr } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { Candles } from "@/components/charts/candles";
import { Spark } from "@/components/charts/spark";
import { Gauge } from "@/components/charts/gauge";
import { VBars } from "@/components/charts/vbars";
import { DeltaChip, Num } from "@/components/number";
import { QuadrantTable } from "@/components/quadrant-table";
import { Btn, Card, CardHeader, Chip, SectionTitle, Select, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface OverviewResp {
  status: { label: string; dateLabel: string; status: string };
  indices: { symbol: string; name: string; exch: string; price: number; chg: number; chgPct: number; spark: number[]; prevClose: number }[];
  vix: { value: number; chg: number; chgPct: number };
  breadth: { adv: number; dec: number; unch: number };
  flows: { today: { label: string; fii: number; dii: number }; history: { label: string; value: number }[] };
  niftyPcr: number;
  bankPcr: number;
  niftyMaxPain: number;
  asOf: string;
}
interface IntradayResp { candles: Candle[] }
interface Quote { symbol: string; name: string; kind: string; price: number; chg: number; chgPct: number; open: number; high: number; low: number }
interface WatchResp { items: { id: number; symbol: string; label: string; kind: string }[]; quotes: Quote[] }
interface BriefResp { brief?: Brief }
interface AnalyticsResp { buildup: BuildupRow[] }

export default function OverviewPage() {
  const ov = usePolling<OverviewResp>("/api/market/overview", 12000);
  const wl = usePolling<WatchResp>("/api/watchlist", 20000);
  const buildup = usePolling<AnalyticsResp>("/api/market/analytics?symbol=NIFTY", 20000);
  const brief = usePolling<BriefResp>("/api/ai/brief", 0);
  const [focus, setFocus] = useState("NIFTY");
  const intra = usePolling<IntradayResp>(`/api/market/intraday?symbol=${focus}`, 15000);
  const [addSym, setAddSym] = useState("FINNIFTY");
  const [busy, setBusy] = useState(false);

  const addToWatch = async () => {
    setBusy(true);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: addSym }),
    }).catch(() => null);
    setBusy(false);
    wl.refresh();
  };
  const remove = async (symbol: string) => {
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    }).catch(() => null);
    wl.refresh();
  };

  const quoteMap = useMemo(() => new Map((wl.data?.quotes ?? []).map((q) => [q.symbol, q])), [wl.data]);
  const watchChoices = useMemo(
    () => ALL.filter((i) => !(wl.data?.items ?? []).some((w) => w.symbol === i.symbol)),
    [wl.data]
  );

  const rise = (i: number) => ({ animationDelay: `${i * 60}ms` });

  return (
    <div className="space-y-4">
      {/* context strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-faint animate-rise">
        <span className="font-semibold text-sub">{ov.data?.status.dateLabel ?? "—"}</span>
        <span className="hidden h-3 w-px bg-line2 sm:block" />
        <span>{ov.data?.status.label ?? "Loading session…"}</span>
        <span className="hidden h-3 w-px bg-line2 sm:block" />
        <span>Refresh 12s</span>
        <span className="ml-auto flex items-center gap-2">
          <Chip tone="brand" className="tip cursor-help" data-tip="NIFTY Put-Call Ratio by open interest">PCR {ov.data?.niftyPcr ?? "—"}</Chip>
          <Chip tone="flat" className="tip cursor-help" data-tip="NIFTY Max Pain for the current weekly expiry">MP {ov.data ? fmtIN(ov.data.niftyMaxPain, 0) : "—"}</Chip>
          <Chip tone={ov.data && ov.data.vix.chg <= 0 ? "up" : "warn"}>VIX {ov.data?.vix.value ?? "—"}</Chip>
        </span>
      </div>

      {/* index cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {(ov.data?.indices ?? INDICES.map((i) => null)).map((idx, i) =>
          idx ? (
            <Link key={idx.symbol} href={`/chain?symbol=${idx.symbol}`} className="animate-rise" style={rise(i)}>
              <Card className="group relative h-full p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-line hover:shadow-raise active:scale-[0.99]">
                <ArrowUpRight
                  size={14}
                  className="absolute right-3 top-3 text-brand opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
                <div className="flex items-center justify-between pr-4">
                  <p className="max-w-[130px] truncate text-[11px] font-semibold text-sub group-hover:text-ink">{idx.name}</p>
                  <span className="text-[9px] font-bold tracking-wider text-faint">{idx.exch}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <Num value={idx.price} className="text-[17px] font-bold tracking-tight" />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <DeltaChip pct={idx.chgPct} />
                  <Spark data={idx.spark} width={92} height={30} up={idx.chgPct >= 0} />
                </div>
              </Card>
            </Link>
          ) : (
            <Skeleton key={i} className="h-[106px]" />
          )
        )}
      </div>

      {/* chart + internals */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 animate-rise" >
          <CardHeader
            title="Intraday · 5-minute"
            sub="Simulated tick stream, 09:15–15:30 IST"
            right={
              <div className="flex rounded-lg border border-line bg-paper p-0.5">
                {INDICES.map((i) => (
                  <button
                    key={i.symbol}
                    onClick={() => setFocus(i.symbol)}
                    className={cn(
                      "rounded-[7px] px-2 py-1 text-[11px] font-semibold transition-all",
                      focus === i.symbol ? "bg-panel text-brand-deep shadow-card" : "text-faint hover:text-sub"
                    )}
                  >
                    {i.symbol}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-3">
            {intra.data ? <Candles candles={intra.data.candles} height={322} /> : <Skeleton className="h-[322px]" />}
          </div>
        </Card>

        <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
          <CardHeader title="Market internals" sub="Breadth, volatility and positioning" right={<Chip tone="flat">{ov.data?.asOf ?? "…"}</Chip>} />
          <div className="space-y-5 p-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-sub">NIFTY 50 breadth</span>
                <span className="num text-faint">{ov.data?.breadth.adv ?? "–"}A / {ov.data?.breadth.dec ?? "–"}D</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-line">
                <div className="bg-up transition-all duration-500" style={{ width: `${((ov.data?.breadth.adv ?? 25) / 50) * 100}%` }} />
                <div className="bg-line2 transition-all duration-500" style={{ width: `${((ov.data?.breadth.unch ?? 0) / 50) * 100}%` }} />
                <div className="flex-1 bg-down/80" />
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <div>
                {ov.data ? (
                  <Gauge
                    value={ov.data.vix.value}
                    min={9}
                    max={26}
                    display={String(ov.data.vix.value)}
                    sub="India VIX"
                    zones={[
                      { to: (13 - 9) / 17, color: "var(--color-up)", label: "" },
                      { to: (17 - 9) / 17, color: "var(--color-warn)", label: "" },
                      { to: 1, color: "var(--color-down)", label: "" },
                    ]}
                  />
                ) : (
                  <Skeleton className="h-[100px]" />
                )}
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">PCR (OI)</p>
                  <div className="mt-1 flex gap-1.5">
                    <Chip tone={(ov.data?.niftyPcr ?? 1) >= 1 ? "up" : "warn"}>N {ov.data?.niftyPcr ?? "—"}</Chip>
                    <Chip tone={(ov.data?.bankPcr ?? 1) >= 1 ? "up" : "warn"}>BNF {ov.data?.bankPcr ?? "—"}</Chip>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">NIFTY Max Pain</p>
                  <p className="num mt-0.5 text-[15px] font-bold">{ov.data ? fmtIN(ov.data.niftyMaxPain, 0) : "—"}</p>
                </div>
                <Link href="/analytics" className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:gap-2 transition-all">
                  Full analytics <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">Options desk read</p>
              <p className="mt-1 text-[12px] leading-relaxed text-sub">
                {(ov.data?.niftyPcr ?? 1) > 1.2
                  ? "Put writers are aggressive — dips are being sold. Watch the nearest put wall for support."
                  : (ov.data?.niftyPcr ?? 1) < 0.85
                    ? "Call writing dominates — rallies carry supply overhead until walls shift."
                    : "Positioning is balanced between the walls; trade the range until a wall breaks with OI confirmation."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* futures build-up + flows */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 animate-rise">
          <CardHeader
            title="Futures OI build-up"
            sub="Price × open-interest quadrants across the F&O universe"
            right={<Link href="/analytics" className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:gap-2 transition-all">All contracts <ArrowRight size={13} /></Link>}
          />
          <div className="pb-2">
            {buildup.data ? <QuadrantTable rows={buildup.data.buildup} compact /> : <Skeleton className="m-4 h-[300px]" />}
          </div>
        </Card>

        <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
          <CardHeader title="Institutional flows" sub="Provisional cash-market activity" />
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-paper/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">FII cash</p>
                <p className={cn("num mt-1 text-[16px] font-bold", (ov.data?.flows.today.fii ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {ov.data ? fmtCr(ov.data.flows.today.fii) : "—"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-faint">{(ov.data?.flows.today.fii ?? 0) >= 0 ? "Net bought" : "Net sold"}</p>
              </div>
              <div className="rounded-lg border border-line bg-paper/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">DII cash</p>
                <p className={cn("num mt-1 text-[16px] font-bold", (ov.data?.flows.today.dii ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {ov.data ? fmtCr(ov.data.flows.today.dii) : "—"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-faint">{(ov.data?.flows.today.dii ?? 0) >= 0 ? "Net bought" : "Net sold"}</p>
              </div>
            </div>
            <p className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">FII cash · last 7 sessions (₹ Cr)</p>
            {ov.data ? (
              <VBars items={ov.data.flows.history.map((h) => ({ label: h.label.split(" ")[0] + " " + h.label.split(" ")[1], value: h.value }))} height={120} />
            ) : (
              <Skeleton className="h-[120px]" />
            )}
          </div>
        </Card>
      </div>

      {/* watchlist + brief */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 animate-rise">
          <CardHeader
            title="Watchlist"
            sub="Persisted to Postgres · live quotes"
            right={
              <div className="flex items-center gap-2">
                <Select value={addSym} onChange={(e) => setAddSym(e.target.value)} className="h-8 text-[12px]">
                  {watchChoices.map((i) => (
                    <option key={i.symbol} value={i.symbol}>{i.name}</option>
                  ))}
                </Select>
                <Btn variant="solid" size="sm" onClick={addToWatch} disabled={busy || watchChoices.length === 0}>
                  <ListPlus size={14} /> Add
                </Btn>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-[#fbfaf6] text-left text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint">
                  <th className="py-2 pl-4 pr-2">Symbol</th>
                  <th className="px-2 py-2 text-right">LTP</th>
                  <th className="px-2 py-2 text-right">Chg</th>
                  <th className="px-2 py-2 text-center">Day range</th>
                  <th className="px-2 py-2 text-right">Open</th>
                  <th className="py-2 pl-2 pr-4 text-right">Prev close</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {(wl.data?.items ?? []).map((item) => {
                  const q = quoteMap.get(item.symbol);
                  const pos = q ? Math.min(Math.max((q.price - q.low) / Math.max(q.high - q.low, 0.0001), 0), 1) : 0.5;
                  return (
                    <tr key={item.symbol} className="group border-b border-line/70 transition-colors last:border-0 hover:bg-paper/70">
                      <td className="py-2.5 pl-4 pr-2">
                        <Link href={item.kind === "index" ? `/chain?symbol=${item.symbol}` : `/strategy?symbol=${item.symbol}`} className="text-[12.5px] font-semibold hover:text-brand">
                          {item.symbol}
                        </Link>
                        <div className="text-[10.5px] text-faint">{item.label}</div>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {q ? <Num value={q.price} className="text-[12.5px] font-semibold" /> : "—"}
                      </td>
                      <td className="px-2 py-2.5 text-right">{q ? <DeltaChip pct={q.chgPct} /> : "—"}</td>
                      <td className="px-2 py-2.5">
                        <div className="relative mx-auto h-[3px] w-24 rounded-full bg-line">
                          <span className="absolute top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full border border-panel bg-ink shadow-sm" style={{ left: `calc(${pos * 100}% - 3.5px)` }} />
                        </div>
                        <div className="num mt-1 flex justify-between text-[9px] text-faint">
                          <span>{q ? fmtIN(q.low, 0) : ""}</span>
                          <span>{q ? fmtIN(q.high, 0) : ""}</span>
                        </div>
                      </td>
                      <td className="num px-2 py-2.5 text-right text-[12px] text-sub">{q ? fmtIN(q.open) : "—"}</td>
                      <td className="num py-2.5 pl-2 pr-2 text-right text-[12px] text-sub">{q ? fmtIN(q.price - q.chg) : "—"}</td>
                      <td className="pr-2 text-right">
                        <button onClick={() => remove(item.symbol)} className="rounded-md p-1 text-faint opacity-0 transition-all hover:bg-down-soft hover:text-down group-hover:opacity-100" title="Remove">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!wl.data && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8" /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
          <CardHeader title="Desk brief" sub="Auto-generated by the research copilot" right={<Sparkles size={15} className="text-brand" />} />
          <div className="flex h-full flex-col p-4">
            {brief.data?.brief ? (
              <>
                <p className="text-[13px] font-semibold leading-snug">{brief.data.brief.title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-sub">{brief.data.brief.lead}</p>
                <ul className="mt-3 space-y-2">
                  {brief.data.brief.sections[0].bullets.slice(0, 2).map((b, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-sub">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link href="/research" className="group mt-auto inline-flex items-center gap-1 pt-4 text-[12px] font-semibold text-brand transition-all hover:gap-2">
                  Open full brief & copilot <ArrowRight size={13} />
                </Link>
              </>
            ) : (
              <div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
