"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bookmark, Check, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { bs } from "@/lib/market/bs";
import type { ChainResult } from "@/lib/market/engine";
import { INDICES, STOCKS } from "@/lib/market/universe";
import type { SavedStrategy, StrategyLeg } from "@/lib/types";
import { fmtIN, timeAgo } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { Payoff } from "@/components/charts/payoff";
import { Btn, Card, CardHeader, Chip, Input, Select, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------- payoff math ------------------------------- */

function legPayoff(leg: StrategyLeg, qty: number, p: number): number {
  const dir = leg.side === "BUY" ? 1 : -1;
  if (leg.kind === "FUT") return (p - leg.entry) * dir * qty;
  const K = leg.strike ?? 0;
  const intrinsic = leg.kind === "CE" ? Math.max(p - K, 0) : Math.max(K - p, 0);
  return (intrinsic - leg.entry) * dir * qty;
}

/* --------------------------------- presets -------------------------------- */

type PresetFn = (c: ChainResult) => StrategyLeg[];

const PRESETS: { id: string; label: string; bias: string; build: PresetFn }[] = [
  { id: "bullcall", label: "Bull Call Spread", bias: "Bullish", build: (c) => [
      { kind: "CE", side: "BUY", strike: c.atm, lots: 1, entry: px(c, "CE", c.atm) },
      { kind: "CE", side: "SELL", strike: c.resistances[0] ?? c.atm + 2 * c.step, lots: 1, entry: px(c, "CE", c.resistances[0] ?? c.atm + 2 * c.step) },
    ] },
  { id: "bearput", label: "Bear Put Spread", bias: "Bearish", build: (c) => [
      { kind: "PE", side: "BUY", strike: c.atm, lots: 1, entry: px(c, "PE", c.atm) },
      { kind: "PE", side: "SELL", strike: c.supports[0] ?? c.atm - 2 * c.step, lots: 1, entry: px(c, "PE", c.supports[0] ?? c.atm - 2 * c.step) },
    ] },
  { id: "straddle", label: "Long Straddle", bias: "Volatility up", build: (c) => [
      { kind: "CE", side: "BUY", strike: c.atm, lots: 1, entry: px(c, "CE", c.atm) },
      { kind: "PE", side: "BUY", strike: c.atm, lots: 1, entry: px(c, "PE", c.atm) },
    ] },
  { id: "strangle", label: "Short Strangle", bias: "Range", build: (c) => [
      { kind: "PE", side: "SELL", strike: c.atm - 2 * c.step, lots: 1, entry: px(c, "PE", c.atm - 2 * c.step) },
      { kind: "CE", side: "SELL", strike: c.atm + 2 * c.step, lots: 1, entry: px(c, "CE", c.atm + 2 * c.step) },
    ] },
  { id: "condor", label: "Iron Condor (OI walls)", bias: "Range", build: (c) => {
      const sp = c.supports[0] ?? c.atm - 2 * c.step;
      const rs = c.resistances[0] ?? c.atm + 2 * c.step;
      return [
        { kind: "PE", side: "SELL", strike: sp, lots: 1, entry: px(c, "PE", sp) },
        { kind: "PE", side: "BUY", strike: sp - 2 * c.step, lots: 1, entry: px(c, "PE", sp - 2 * c.step) },
        { kind: "CE", side: "SELL", strike: rs, lots: 1, entry: px(c, "CE", rs) },
        { kind: "CE", side: "BUY", strike: rs + 2 * c.step, lots: 1, entry: px(c, "CE", rs + 2 * c.step) },
      ];
    } },
  { id: "ironfly", label: "Iron Fly", bias: "Pin at ATM", build: (c) => [
      { kind: "PE", side: "BUY", strike: c.atm - 2 * c.step, lots: 1, entry: px(c, "PE", c.atm - 2 * c.step) },
      { kind: "CE", side: "SELL", strike: c.atm, lots: 1, entry: px(c, "CE", c.atm) },
      { kind: "PE", side: "SELL", strike: c.atm, lots: 1, entry: px(c, "PE", c.atm) },
      { kind: "CE", side: "BUY", strike: c.atm + 2 * c.step, lots: 1, entry: px(c, "CE", c.atm + 2 * c.step) },
    ] },
  { id: "covered", label: "Covered Call", bias: "Mild bull", build: (c) => [
      { kind: "FUT", side: "BUY", lots: 1, entry: c.spot },
      { kind: "CE", side: "SELL", strike: c.atm + c.step, lots: 1, entry: px(c, "CE", c.atm + c.step) },
    ] },
  { id: "protective", label: "Protective Put", bias: "Hedge", build: (c) => [
      { kind: "FUT", side: "BUY", lots: 1, entry: c.spot },
      { kind: "PE", side: "BUY", strike: c.atm - c.step, lots: 1, entry: px(c, "PE", c.atm - c.step) },
    ] },
];

function px(c: ChainResult, kind: "CE" | "PE", strike: number): number {
  const row = c.strikes.find((s) => s.strike === strike) ?? c.strikes[0];
  return kind === "CE" ? row.ce.ltp : row.pe.ltp;
}

/* ---------------------------------- page ---------------------------------- */

function StrategyInner() {
  const sp = useSearchParams();
  const [symbol, setSymbol] = useState(sp.get("symbol")?.toUpperCase() ?? "NIFTY");
  useEffect(() => {
    const s = sp.get("symbol");
    if (s && s.toUpperCase() !== symbol) setSymbol(s.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const chain = usePolling<ChainResult>(`/api/market/chain?symbol=${symbol}`, 30000);
  const saved = usePolling<{ strategies: SavedStrategy[] }>("/api/strategies", 0);

  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [name, setName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const lot = chain.data?.lot ?? 1;

  // default structure once chain loads
  useEffect(() => {
    if (chain.data && legs.length === 0) {
      setLegs(PRESETS.find((p) => p.id === "condor")!.build(chain.data));
      setName(`${symbol} Iron Condor`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.data, symbol]);

  /* ------------------------------ analytics ------------------------------ */

  const A = useMemo(() => {
    const c = chain.data;
    if (!c || legs.length === 0) return null;
    const S = c.spot;
    const T = Math.max(c.dte, 1) / 365;
    const iv = c.atmIv / 100;
    const lo = S * 0.94;
    const hi = S * 1.06;
    const N = 181;
    const pts = Array.from({ length: N }, (_, i) => {
      const p = lo + ((hi - lo) * i) / (N - 1);
      const y = legs.reduce((acc, leg) => acc + legPayoff(leg, leg.lots * lot, p), 0);
      return { x: Math.round(p), y: Math.round(y) };
    });
    let maxP = -Infinity;
    let maxL = Infinity;
    pts.forEach((p) => {
      maxP = Math.max(maxP, p.y);
      maxL = Math.min(maxL, p.y);
    });
    const bes: number[] = [];
    for (let i = 1; i < N; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a.y === 0) bes.push(a.x);
      else if ((a.y < 0 && b.y > 0) || (a.y > 0 && b.y < 0)) {
        bes.push(Math.round(a.x + ((0 - a.y) / (b.y - a.y)) * (b.x - a.x)));
      }
    }
    // unbounded detection
    const slopeR = pts[N - 1].y - pts[N - 2].y;
    const slopeL = pts[1].y - pts[0].y;
    const profitOpen = maxP === pts[N - 1].y && slopeR > 0;
    const lossOpen = maxL === pts[0].y && slopeL < 0;

    const netPremium = legs.reduce(
      (acc, leg) => acc + (leg.side === "BUY" ? -1 : 1) * (leg.kind === "FUT" ? 0 : leg.entry) * leg.lots * lot,
      0
    );

    let dDelta = 0;
    let dTheta = 0;
    let dVega = 0;
    for (const leg of legs) {
      const dir = leg.side === "BUY" ? 1 : -1;
      const qty = leg.lots * lot;
      if (leg.kind === "FUT") {
        dDelta += dir * qty;
      } else {
        const g = bs(leg.kind, S, leg.strike ?? S, T, iv);
        dDelta += g.delta * dir * qty;
        dTheta += g.theta * dir * qty;
        dVega += g.vega * dir * qty;
      }
    }

    // probability of profit + expected value (deterministic LCG samples)
    let seed = 7;
    const rand = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const M = 900;
    let wins = 0;
    let ev = 0;
    for (let i = 0; i < M; i++) {
      const u1 = Math.max(rand(), 1e-9);
      const u2 = rand();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const pT = S * Math.exp(-0.5 * iv * iv * T + iv * Math.sqrt(T) * z);
      const y = legs.reduce((acc, leg) => acc + legPayoff(leg, leg.lots * lot, pT), 0);
      if (y > 0) wins++;
      ev += y;
    }
    ev /= M;

    const futNotional = legs.filter((l) => l.kind === "FUT").reduce((acc, l) => acc + S * l.lots * lot, 0);
    const margin = Math.abs(Math.min(maxL, 0)) + Math.max(-netPremium, 0) + futNotional * 0.12;

    return { pts, maxP, maxL, bes, profitOpen, lossOpen, netPremium, dDelta, dTheta, dVega, pop: Math.round((wins / M) * 100), ev: Math.round(ev), margin };
  }, [legs, chain.data, lot]);

  /* ------------------------------ mutations ------------------------------ */

  const mutateLeg = (i: number, patch: Partial<StrategyLeg>) => {
    setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const save = async () => {
    if (!chain.data || legs.length === 0) return;
    const res = await fetch("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "Untitled structure", symbol, expiry: chain.data.expiry, legs }),
    });
    if (res.ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      saved.refresh();
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/strategies?id=${id}`, { method: "DELETE" }).catch(() => null);
    saved.refresh();
  };

  const strikes = chain.data?.strikes.map((s) => s.strike) ?? [];

  return (
    <div className="space-y-4 animate-rise">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={symbol} onChange={(e) => { setSymbol(e.target.value); setLegs([]); }} className="min-w-[190px]">
          <optgroup label="Indices">
            {INDICES.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}
          </optgroup>
          <optgroup label="F&O Stocks">
            {STOCKS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}
          </optgroup>
        </Select>
        {chain.data && (
          <>
            <Chip tone="brand">Spot {fmtIN(chain.data.spot)}</Chip>
            <Chip tone="flat">{chain.data.expiryLabel} · {chain.data.dte}d</Chip>
            <Chip tone="flat">Lot {chain.data.lot}</Chip>
            <Chip tone={chain.data.ivr >= 60 ? "warn" : "flat"}>ATM IV {chain.data.atmIv}%</Chip>
          </>
        )}
        <span className="ml-auto hidden text-[11px] text-faint sm:block">Premia from the live chain · P&L at expiry</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* construction */}
        <Card className="xl:col-span-2">
          <CardHeader title="Structure" sub="Preset desks or build your own, leg by leg" />
          <div className="grid grid-cols-2 gap-1.5 p-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                disabled={!chain.data}
                onClick={() => chain.data && setLegs(p.build(chain.data))}
                className="group rounded-lg border border-line bg-paper/50 px-2.5 py-2 text-left transition-all hover:border-brand hover:bg-brand-soft/40 disabled:opacity-50"
              >
                <p className="text-[11.5px] font-semibold group-hover:text-brand-deep">{p.label}</p>
                <p className="text-[10px] text-faint">{p.bias}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-line p-3">
            <div className="mb-2 grid grid-cols-[52px_1fr_1fr_52px_76px_24px] items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint">
              <span>Side</span><span>Type</span><span>Strike</span><span>Lots</span><span className="text-right">Entry</span><span />
            </div>
            <div className="space-y-1.5">
              {legs.map((leg, i) => (
                <div key={i} className="grid grid-cols-[52px_1fr_1fr_52px_76px_24px] items-center gap-1.5">
                  <button
                    onClick={() => mutateLeg(i, { side: leg.side === "BUY" ? "SELL" : "BUY" })}
                    className={cn(
                      "h-8 rounded-md text-[11px] font-bold transition-colors",
                      leg.side === "BUY" ? "bg-up-soft text-up hover:bg-up hover:text-white" : "bg-down-soft text-down hover:bg-down hover:text-white"
                    )}
                  >
                    {leg.side === "BUY" ? "B" : "S"}
                  </button>
                  <Select
                    value={leg.kind}
                    onChange={(e) => {
                      const kind = e.target.value as StrategyLeg["kind"];
                      mutateLeg(i, kind === "FUT" ? { kind, strike: undefined, entry: chain.data?.spot ?? leg.entry } : { kind, strike: leg.strike ?? chain.data?.atm ?? strikes[0], entry: chain.data ? px(chain.data, kind as "CE" | "PE", leg.strike ?? chain.data.atm) : leg.entry });
                    }}
                    className="h-8 text-[12px]"
                  >
                    <option value="CE">Call</option>
                    <option value="PE">Put</option>
                    <option value="FUT">Future</option>
                  </Select>
                  {leg.kind === "FUT" ? (
                    <span className="num flex h-8 items-center justify-center rounded-lg bg-paper text-[11px] font-semibold text-faint">—</span>
                  ) : (
                    <Select
                      value={leg.strike}
                      onChange={(e) => {
                        const k = Number(e.target.value);
                        mutateLeg(i, chain.data && leg.kind !== "FUT" ? { strike: k, entry: px(chain.data, leg.kind, k) } : { strike: k });
                      }}
                      className="num h-8 text-[12px]"
                    >
                      {strikes.map((k) => <option key={k} value={k}>{k.toLocaleString("en-IN")}</option>)}
                    </Select>
                  )}
                  <Input
                    type="number" min={1} max={100} value={leg.lots}
                    onChange={(e) => mutateLeg(i, { lots: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
                    className="num h-8 px-1.5 text-center text-[12px]"
                  />
                  <Input
                    type="number" min={0} step={0.05} value={leg.entry}
                    onChange={(e) => mutateLeg(i, { entry: Math.max(0, Number(e.target.value) || 0) })}
                    className="num h-8 px-1.5 text-right text-[12px]"
                  />
                  <button onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))} className="rounded-md p-1 text-faint transition-colors hover:bg-down-soft hover:text-down">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <Btn
              variant="outline" size="sm" className="mt-3 w-full"
              disabled={!chain.data}
              onClick={() => chain.data && setLegs((ls) => [...ls, { kind: "CE", side: "BUY", strike: chain.data!.atm, lots: 1, entry: px(chain.data!, "CE", chain.data!.atm) }])}
            >
              <Plus size={14} /> Add leg
            </Btn>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Entry defaults to the live chain premium — override it to mark a real fill. “Future” legs carry Δ 1, no Greeks.
            </p>
          </div>
        </Card>

        {/* payoff + stats */}
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader
              title="Payoff at expiry"
              sub={chain.data ? `Lot ${lot} · ±6% price grid · probability via lognormal simulation (IV ${chain.data.atmIv}%)` : " "}
              right={A ? <Chip tone={A.netPremium >= 0 ? "up" : "warn"}>{A.netPremium >= 0 ? "Net credit" : "Net debit"} ₹{fmtIN(Math.abs(A.netPremium), 0)}</Chip> : null}
            />
            <div className="p-3">
              {A && chain.data ? <Payoff pts={A.pts} spot={chain.data.spot} breakevens={A.bes} height={264} /> : <Skeleton className="h-[264px]" />}
            </div>
            <div className="grid grid-cols-3 gap-px border-t border-line bg-line sm:grid-cols-6">
              {[
                { l: "Max profit", v: A ? (A.profitOpen ? "Open-ended" : `₹${fmtIN(A.maxP, 0)}`) : "—", tone: "up" },
                { l: "Max loss", v: A ? (A.lossOpen ? "Open-ended" : `₹${fmtIN(Math.abs(A.maxL), 0)}`) : "—", tone: "down" },
                { l: "Breakevens", v: A ? (A.bes.length ? A.bes.map((b) => b.toLocaleString("en-IN")).join(" / ") : "—") : "—" },
                { l: "Prob. of profit", v: A ? `${A.pop}%` : "—", tone: A && A.pop >= 55 ? "up" : undefined },
                { l: "Expected value", v: A ? `₹${fmtIN(A.ev, 0)}` : "—" },
                { l: "Indicative margin", v: A ? `₹${fmtIN(A.margin, 0)}` : "—", hint: true },
              ].map((s) => (
                <div key={s.l} className="bg-panel p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">{s.l}</p>
                  <p className={cn("num mt-1 truncate text-[13px] font-bold", s.tone === "up" && "text-up", s.tone === "down" && "text-down")} title={s.hint ? "Max loss + net debit + 12% of futures notional" : undefined}>
                    {s.v}
                  </p>
                </div>
              ))}
            </div>
            {A && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-sub">
                <span className="font-semibold text-faint">Net Greeks</span>
                <span className="num">Δ <b className="text-ink">{A.dDelta.toFixed(0)}</b>/pt</span>
                <span className="num">Θ <b className={A.dTheta >= 0 ? "text-up" : "text-down"}>{A.dTheta >= 0 ? "+" : "−"}₹{fmtIN(Math.abs(A.dTheta), 0)}</b>/day</span>
                <span className="num">Vega <b className="text-ink">{A.dVega >= 0 ? "+" : "−"}₹{fmtIN(Math.abs(A.dVega), 0)}</b>/vol pt</span>
                <span className="ml-auto text-faint">Greeks approximated at flat ATM IV</span>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Save to desk book" sub="Persisted to Postgres — reload anytime" />
            <div className="flex flex-col gap-2 p-3 sm:flex-row">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Structure name (e.g. NIFTY weekly condor)" maxLength={80} />
              <Btn variant="solid" onClick={save} disabled={legs.length === 0 || !chain.data} className="shrink-0">
                {savedFlash ? <Check size={15} /> : <Bookmark size={15} />}
                {savedFlash ? "Saved" : "Save strategy"}
              </Btn>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Desk book"
              sub={`${saved.data?.strategies.length ?? 0} saved structure${(saved.data?.strategies.length ?? 0) === 1 ? "" : "s"}`}
              right={<Btn variant="ghost" size="sm" onClick={() => saved.refresh()}><RefreshCw size={13} /></Btn>}
            />
            <div className="divide-y divide-line">
              {(saved.data?.strategies ?? []).map((s) => (
                <div key={s.id} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold">{s.name}</p>
                      <Chip tone="flat">{s.symbol}</Chip>
                      <span className="text-[10.5px] text-faint">{timeAgo(s.createdAt)}</span>
                    </div>
                    <p className="num mt-1 text-[11px] text-sub">
                      {(s.legs as StrategyLeg[]).map((l) => `${l.side === "BUY" ? "+" : "−"}${l.lots} ${l.kind === "FUT" ? "FUT" : `${l.strike} ${l.kind}`}`).join("  ·  ")}
                    </p>
                    {s.thesis ? <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-faint">{s.thesis}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Btn
                      variant="outline" size="sm"
                      onClick={() => {
                        setSymbol(s.symbol);
                        setLegs(s.legs as StrategyLeg[]);
                        setName(s.name);
                      }}
                    >
                      Load
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => remove(s.id)} className="text-faint hover:text-down">
                      <Trash2 size={14} />
                    </Btn>
                  </div>
                </div>
              ))}
              {saved.data && saved.data.strategies.length === 0 && (
                <p className="px-4 py-8 text-center text-[12px] text-faint">Nothing saved yet — price a structure and hit Save.</p>
              )}
              {!saved.data && <Skeleton className="m-4 h-20" />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function StrategyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <StrategyInner />
    </Suspense>
  );
}
