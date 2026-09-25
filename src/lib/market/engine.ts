/**
 * Market engine — a deterministic, self-consistent simulation of Indian F&O
 * markets. Every number derives from (symbol, trading-day, live bucket) seeds,
 * so the "market" is identical for every viewer and evolves intraday.
 *
 * In production this layer would sit on top of a broker/exchange feed
 * (e.g. tick store → chain builder → analytics). The analytics math
 * (PCR, Max Pain, IV smile, build-up classification, Greeks) is real.
 */

import { clamp, gauss, hash32, mulberry32, rngOf } from "./rng";
import {
  SESSION_MINUTES,
  dteDays,
  formatDayKey,
  latestTradingDayKey,
  liveMinute,
  marketStatus,
  monthlyExpiryDates,
  nextWeekdayDates,
  prevTradingDayKey,
} from "./time";
import { bs, probAbove } from "./bs";
import { ALL, INDICES, STOCKS, instrument } from "./universe";

export interface Candle {
  t: number; // minutes from 09:15
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const BARS = 75; // 5-minute bars in a 375-minute session
const BUCKET_MS = 12_000; // live prices wiggle every 12s

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Intraday path                                                       */
/* ------------------------------------------------------------------ */

export function getCandles(symbol: string, dayKey?: string): Candle[] {
  const inst = instrument(symbol);
  const day = dayKey ?? latestTradingDayKey();
  const r = rngOf(`path:${inst.symbol}:${day}`);

  const drift = (r() * 2 - 1) * inst.dayRange; // day's directional move
  const gap = (r() * 2 - 1) * 0.004;
  const a1 = inst.base * (0.0022 + r() * 0.0038);
  const k1 = 2.1 + r() * 2.4;
  const p1 = r() * Math.PI * 2;
  const a2 = inst.base * (0.0011 + r() * 0.002);
  const k2 = 6 + r() * 7;
  const p2 = r() * Math.PI * 2;
  const volScale = inst.base * inst.volTick;
  const baseVol = (200 + hash32(inst.symbol) % 400) * inst.oiScale;

  const candles: Candle[] = [];
  let px = inst.base * (1 + gap);
  for (let i = 0; i < BARS; i++) {
    const frac = i / (BARS - 1);
    const target =
      inst.base * (1 + gap + drift * frac) + a1 * Math.sin(frac * k1 * Math.PI + (p1 * i) / BARS) * 0.4 +
      a2 * Math.sin(frac * k2 + p2) * 0.35;
    const open = px;
    px = px + (target - px) * 0.24 + gauss(r) * volScale;
    const hi = Math.max(open, px) + Math.abs(gauss(r)) * volScale * 0.45;
    const lo = Math.min(open, px) - Math.abs(gauss(r)) * volScale * 0.45;
    const uShape = 1 + 1.5 * Math.exp(-i / 7) + 1.1 * Math.exp(-(BARS - 1 - i) / 9);
    const vol = baseVol * uShape * (0.65 + 0.7 * r());
    candles.push({ t: i * 5, o: r2(open), h: r2(hi), l: r2(lo), c: r2(px), v: Math.round(vol) });
  }
  return candles;
}

export interface SpotQuote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  chg: number;
  chgPct: number;
  open: number;
  high: number;
  low: number;
  minute: number;
}

export function getSpot(symbol: string, dayKey?: string): SpotQuote {
  const inst = instrument(symbol);
  const day = dayKey ?? latestTradingDayKey();
  const past = getCandles(inst.symbol, prevTradingDayKey(day));
  const prevClose = past[past.length - 1].c;

  const bars = getCandles(inst.symbol, day);
  const minute = dayKey ? SESSION_MINUTES : liveMinute();
  const upto = clamp(Math.floor(minute / 5), 0, BARS - 1);
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const liveRng = rngOf(`tick:${inst.symbol}:${day}:${bucket}`);

  let high = -Infinity;
  let low = Infinity;
  for (let i = 0; i <= upto; i++) {
    high = Math.max(high, bars[i].h);
    low = Math.min(low, bars[i].l);
  }
  const wiggle = 1 + (liveRng() - 0.5) * 0.0012;
  const price = clamp(bars[upto].c * wiggle, low, high * 1.0004);
  return {
    symbol: inst.symbol,
    name: inst.name,
    price: r2(price),
    prevClose,
    chg: r2(price - prevClose),
    chgPct: r2(((price - prevClose) / prevClose) * 100),
    open: bars[0].o,
    high: r2(high),
    low: r2(low),
    minute,
  };
}

/** Down-sampled closes for sparklines (includes prevClose as anchor). */
export function getSpark(symbol: string, points = 40): number[] {
  const day = latestTradingDayKey();
  const bars = getCandles(symbol, day);
  const minute = liveMinute();
  const upto = clamp(Math.floor(minute / 5), 1, BARS - 1);
  const step = Math.max(1, Math.floor(upto / points));
  const out: number[] = [];
  for (let i = 0; i <= upto; i += step) out.push(bars[i].c);
  if (out[out.length - 1] !== bars[upto].c) out.push(bars[upto].c);
  return out;
}

/* ------------------------------------------------------------------ */
/* Expiries                                                            */
/* ------------------------------------------------------------------ */

export interface ExpiryInfo {
  key: string;
  label: string;
  kind: "W" | "M";
  dte: number;
}

export function getExpiries(symbol: string, dayKey?: string): ExpiryInfo[] {
  const inst = instrument(symbol);
  const day = dayKey ?? latestTradingDayKey();
  const out: ExpiryInfo[] = [];
  if (inst.weekly) {
    for (const k of nextWeekdayDates(inst.expiryWkday, 3, day)) {
      out.push({ key: k, label: formatDayKey(k), kind: "W", dte: dteDays(day, k) });
    }
    for (const k of monthlyExpiryDates(inst.expiryWkday, 2, day)) {
      if (!out.some((e) => e.key === k))
        out.push({ key: k, label: formatDayKey(k), kind: "M", dte: dteDays(day, k) });
    }
  } else {
    for (const k of monthlyExpiryDates(inst.expiryWkday, 3, day)) {
      out.push({ key: k, label: formatDayKey(k), kind: "M", dte: dteDays(day, k) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Option chain                                                        */
/* ------------------------------------------------------------------ */

export interface OptionQuote {
  oi: number;
  chgOi: number;
  vol: number;
  iv: number; // %
  ltp: number;
  chg: number; // abs move of the premium
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface ChainStrike {
  strike: number;
  ce: OptionQuote;
  pe: OptionQuote;
}

export interface ChainResult {
  symbol: string;
  name: string;
  kind: "index" | "stock";
  lot: number;
  step: number;
  exch: string;
  expiry: string;
  expiryLabel: string;
  dte: number;
  spot: number;
  prevClose: number;
  chgPct: number;
  atm: number;
  strikes: ChainStrike[];
  expiries: ExpiryInfo[];
  totCeOi: number;
  totPeOi: number;
  totCeVol: number;
  totPeVol: number;
  pcrOi: number;
  pcrVol: number;
  maxPain: number;
  atmIv: number;
  ivr: number;
  straddle: number;
  expectedMovePct: number;
  spotBetween: [number, number];
  supports: number[];
  resistances: number[];
  asOf: string;
}

function contractOi(scale: number, weight: number): number {
  return Math.round((scale * 1250 * weight) / 10) * 10;
}

export function getChain(symbol: string, expiryKey?: string): ChainResult {
  const inst = instrument(symbol);
  const day = latestTradingDayKey();
  const spot = getSpot(inst.symbol);
  const expiries = getExpiries(inst.symbol);
  const expiry = expiries.some((e) => e.key === expiryKey) ? (expiryKey as string) : expiries[0].key;
  const expInfo = expiries.find((e) => e.key === expiry)!;

  const S = spot.price;
  const atm = Math.round(S / inst.step) * inst.step;
  const half = inst.kind === "index" ? 22 : 16;

  // time to expiry in years (expiry day closes 15:30)
  const minutesNow = liveMinute();
  const minutesLeftToday = Math.max(SESSION_MINUTES - minutesNow, 0);
  const dte = dteDays(day, expiry);
  const totalMin = Math.max(dte * SESSION_MINUTES + minutesLeftToday, 30);
  const T = totalMin / (365 * 24 * 60);
  const progress = clamp(minutesNow / SESSION_MINUTES, 0.02, 1);

  const isIdx = inst.kind === "index";
  const skew = isIdx ? 0.62 : 0.45;
  const convex = isIdx ? 5.2 : 8.5;
  const ivDayJit = (rngOf(`ivday:${inst.symbol}:${day}`)() - 0.5) * 0.02;
  const expiryBump = 0.006 / Math.sqrt(Math.max(dte, 1)); // short-dated runs hotter

  // OI walls — sticky for the whole expiry
  const wallR = rngOf(`walls:${inst.symbol}:${expiry}`);
  const callWall1 = 2 + Math.floor(wallR() * 4); // steps above ATM
  const callWall2 = callWall1 + 3 + Math.floor(wallR() * 4);
  const putWall1 = 2 + Math.floor(wallR() * 4); // steps below ATM
  const putWall2 = putWall1 + 3 + Math.floor(wallR() * 4);
  const w1 = 1;
  const w2 = 0.45 + wallR() * 0.2;

  const dayMove = spot.chgPct / 100;
  const dayR = rngOf(`dayprev:${inst.symbol}:${day}`);

  let totCeOi = 0;
  let totPeOi = 0;
  let totCeVol = 0;
  let totPeVol = 0;
  const strikes: ChainStrike[] = [];

  const ceOiByStrike = new Map<number, number>();
  const peOiByStrike = new Map<number, number>();

  for (let i = -half; i <= half; i++) {
    const K = atm + i * inst.step;
    const sRng = rngOf(`strike:${inst.symbol}:${expiry}:${K}`);
    const m = Math.log(K / S);

    const ivNum = Math.max(
      inst.ivBase + expiryBump + ivDayJit - skew * m * (isIdx ? 1 : 0.7) + convex * m * m + (sRng() - 0.5) * 0.004,
      0.035
    );

    const ceG = bs("CE", S, K, T, ivNum);
    const peG = bs("PE", S, K, T, ivNum);
    const jit = sRng() * 2 - 1;

    // --- Open interest: gaussian walls + broad base -------------------
    const width = 1.35;
    const distC1 = (i - callWall1) / width;
    const distC2 = (i - callWall2) / (width * 2);
    const distP1 = (-i - putWall1) / width;
    const distP2 = (-i - putWall2) / (width * 2);
    const broad = Math.exp(-((i / (half * 0.62)) ** 2));

    const ceOi = Math.max(
      contractOi(
        inst.oiScale,
        (w1 * Math.exp(-distC1 * distC1) + w2 * Math.exp(-distC2 * distC2) + 0.34 * broad) * (0.84 + sRng() * 0.34)
      ),
      640
    );
    const peOi = Math.max(
      contractOi(
        inst.oiScale,
        (w1 * Math.exp(-distP1 * distP1) + w2 * Math.exp(-distP2 * distP2) + 0.34 * broad) * (0.84 + sRng() * 0.34)
      ),
      640
    );

    // --- Change in OI (accumulates through the session) ---------------
    // Up day: puts under spot build (support writing), calls shed & vice-versa.
    const dirCe = -dayMove * 5.5 * (i >= 0 ? 1 : 0.5);
    const dirPe = dayMove * 5.5 * (i <= 0 ? 1 : 0.5);
    const ceChg = clamp((jit * 0.42 + dirCe + (sRng() - 0.5) * 0.3) * progress, -0.82, 1.4);
    const peChg = clamp((-jit * 0.38 + dirPe + (sRng() - 0.5) * 0.3) * progress, -0.82, 1.4);
    const ceChgOi = Math.round((ceOi * ceChg) / 10) * 10;
    const peChgOi = Math.round((peOi * peChg) / 10) * 10;

    // --- Volume -------------------------------------------------------
    const atmBoost = 1 + 2.2 * Math.exp(-((i / 2.4) ** 2));
    const ceVol = Math.round(((Math.abs(ceChgOi) * 1.25 + ceOi * 0.05) * atmBoost * (0.5 + sRng()) + 40) / 10) * 10;
    const peVol = Math.round(((Math.abs(peChgOi) * 1.25 + peOi * 0.05) * atmBoost * (0.5 + sRng()) + 40) / 10) * 10;

    totCeOi += ceOi;
    totPeOi += peOi;
    totCeVol += ceVol;
    totPeVol += peVol;
    ceOiByStrike.set(K, ceOi);
    peOiByStrike.set(K, peOi);

    const premMove = S * inst.volTick * 0.35 * dayR();
    strikes.push({
      strike: K,
      ce: {
        oi: ceOi,
        chgOi: ceChgOi,
        vol: ceVol,
        iv: r2(ivNum * 100),
        ltp: r2(ceG.price),
        chg: r2(m < 0 ? premMove * (1 - Math.abs(ceG.delta)) : -premMove * ceG.delta * -1),
        delta: Math.round(ceG.delta * 1000) / 1000,
        gamma: Math.round(ceG.gamma * 1e6) / 1e6,
        theta: r2(ceG.theta),
        vega: r2(ceG.vega),
      },
      pe: {
        oi: peOi,
        chgOi: peChgOi,
        vol: peVol,
        iv: r2(ivNum * 100),
        ltp: r2(peG.price),
        chg: r2(m > 0 ? -premMove * (1 - Math.abs(peG.delta)) : premMove),
        delta: Math.round(peG.delta * 1000) / 1000,
        gamma: Math.round(peG.gamma * 1e6) / 1e6,
        theta: r2(peG.theta),
        vega: r2(peG.vega),
      },
    });
  }

  // --- Max pain --------------------------------------------------------
  let maxPain = atm;
  let minLoss = Infinity;
  for (let i = -half; i <= half; i++) {
    const settle = atm + i * inst.step;
    let loss = 0;
    for (const row of strikes) {
      loss += row.ce.oi * Math.max(settle - row.strike, 0) + row.pe.oi * Math.max(row.strike - settle, 0);
    }
    if (loss < minLoss) {
      minLoss = loss;
      maxPain = settle;
    }
  }

  // --- Supports / resistances from OI walls ----------------------------
  const below = strikes.filter((s) => s.strike <= atm).sort((a, b) => b.pe.oi - a.pe.oi);
  const above = strikes.filter((s) => s.strike >= atm).sort((a, b) => b.ce.oi - a.ce.oi);
  const uniq = (arr: number[]) => [...new Set(arr)].slice(0, 2);
  const supports = uniq(below.map((s) => s.strike)).sort((a, b) => b - a);
  const resistances = uniq(above.map((s) => s.strike)).sort((a, b) => a - b);

  // --- ATM IV + IV rank -------------------------------------------------
  const atmRow = strikes.find((s) => s.strike === atm) ?? strikes[half];
  const atmIv = r2((atmRow.ce.iv + atmRow.pe.iv) / 2);
  let rankCount = 1;
  for (let d = 1; d <= 30; d++) {
    const pastIv =
      inst.ivBase + (rngOf(`ivhist:${inst.symbol}:${d}`)() - 0.5) * 0.05 + (d % 7 === 0 ? 0.02 : 0);
    if (pastIv * 100 <= atmIv) rankCount++;
  }
  const ivr = Math.round((rankCount / 31) * 100);

  const straddle = r2(atmRow.ce.ltp + atmRow.pe.ltp);
  const spotBetween: [number, number] = [
    Math.floor(S / inst.step) * inst.step,
    Math.ceil(S / inst.step) * inst.step,
  ];

  return {
    symbol: inst.symbol,
    name: inst.name,
    kind: inst.kind,
    lot: inst.lot,
    step: inst.step,
    exch: inst.exch,
    expiry,
    expiryLabel: expInfo.label,
    dte: expInfo.dte,
    spot: S,
    prevClose: spot.prevClose,
    chgPct: spot.chgPct,
    atm,
    strikes,
    expiries,
    totCeOi,
    totPeOi,
    totCeVol,
    totPeVol,
    pcrOi: r2(totPeOi / Math.max(totCeOi, 1)),
    pcrVol: r2(totPeVol / Math.max(totCeVol, 1)),
    maxPain,
    atmIv,
    ivr: clamp(ivr, 4, 98),
    straddle,
    expectedMovePct: r2((straddle / S) * 100),
    spotBetween,
    supports,
    resistances,
    asOf: marketStatus().timeLabel,
  };
}

/* ------------------------------------------------------------------ */
/* PCR intraday + Max pain across expiries                             */
/* ------------------------------------------------------------------ */

export function getPcrIntraday(symbol: string): { t: string; pcr: number }[] {
  const day = latestTradingDayKey();
  const now = getChain(symbol); // current PCR is the anchor
  const start = 0.68 + rngOf(`pcrstart:${symbol}:${day}`)() * 0.35;
  const deadline = liveMinute();
  const out: { t: string; pcr: number }[] = [];
  for (let m = 15; m <= Math.max(deadline, 15); m += 15) {
    const f = m / SESSION_MINUTES;
    const noise = (rngOf(`pcr:${symbol}:${day}:${m}`)() - 0.5) * 0.16 * (1 - f * 0.7);
    const pcr = clamp(start + (now.pcrOi - start) * Math.pow(f, 0.8) + noise, 0.25, 2.6);
    const hh = 9 + Math.floor((15 + m) / 60);
    const mm = (15 + m) % 60;
    out.push({ t: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, pcr: r2(pcr) });
  }
  return out;
}

export function getMaxPainSeries(symbol: string): { label: string; dte: number; maxPain: number; spot: number }[] {
  const spot = getSpot(symbol).price;
  return getExpiries(symbol)
    .slice(0, 4)
    .map((e) => {
      const c = getChain(symbol, e.key);
      return { label: e.label, dte: e.dte, maxPain: c.maxPain, spot };
    });
}

/* ------------------------------------------------------------------ */
/* Futures build-up                                                    */
/* ------------------------------------------------------------------ */

export type BuildupClass = "Long Buildup" | "Short Buildup" | "Short Covering" | "Long Unwinding";

export interface BuildupRow {
  symbol: string;
  name: string;
  kind: "index" | "stock";
  lot: number;
  fut: number;
  chgPct: number;
  oi: number;
  oiChgPct: number;
  cls: BuildupClass;
}

export function getBuildup(): BuildupRow[] {
  const day = latestTradingDayKey();
  const rows: BuildupRow[] = ALL.map((inst) => {
    const spot = getSpot(inst.symbol);
    const r = rngOf(`fut:${inst.symbol}:${day}`);
    const chgPct = spot.chgPct + (r() - 0.5) * 0.18;
    let oiChgPct = (r() * 2 - 1) * 11;
    const agrees = r() < 0.62; // most names move with price
    if (agrees) oiChgPct = Math.abs(oiChgPct) * (chgPct >= 0 ? 1 : -1) * (0.4 + r());
    else oiChgPct = -Math.abs(oiChgPct) * (chgPct >= 0 ? 1 : -1) * (0.4 + r());
    oiChgPct = clamp(oiChgPct, -16, 16);
    const oi = Math.round((inst.oiScale * 420000 * (0.5 + r())) / 100) * 100;
    const cls: BuildupClass =
      chgPct >= 0
        ? oiChgPct >= 0
          ? "Long Buildup"
          : "Short Covering"
        : oiChgPct >= 0
          ? "Short Buildup"
          : "Long Unwinding";
    return {
      symbol: inst.symbol,
      name: inst.name,
      kind: inst.kind,
      lot: inst.lot,
      fut: r2(spot.price * (1 + (r() - 0.5) * 0.0012)),
      chgPct: r2(chgPct),
      oi,
      oiChgPct: r2(oiChgPct),
      cls,
    };
  });
  return rows.sort((a, b) => Math.abs(b.oiChgPct) - Math.abs(a.oiChgPct));
}

/* ------------------------------------------------------------------ */
/* VIX, breadth, FII/DII                                               */
/* ------------------------------------------------------------------ */

export function getVix(): { value: number; chg: number; chgPct: number } {
  const day = latestTradingDayKey();
  const base = 11.4 + rngOf(`vixregime:${day.slice(0, 7)}`)() * 3.6;
  const niftyMove = getSpot("NIFTY").chgPct;
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const live =
    base -
    niftyMove * 0.55 +
    (rngOf(`vixtick:${day}:${bucket}`)() - 0.5) * 0.3;
  const prev = 11.4 + rngOf(`vixregime:${prevTradingDayKey(day).slice(0, 7)}`)() * 3.6 + (rngOf(`vixprev:${day}`)() - 0.5);
  const value = clamp(r2(live), 8.8, 26);
  return { value, chg: r2(value - prev), chgPct: r2(((value - prev) / prev) * 100) };
}

export function getBreadth(): { adv: number; dec: number; unch: number } {
  const day = latestTradingDayKey();
  const move = getSpot("NIFTY").chgPct / 100;
  const r = rngOf(`breadth:${day}`);
  const advF = clamp(0.5 + move * 26 + (r() - 0.5) * 0.16, 0.06, 0.94);
  const adv = Math.round(advF * 50);
  const dec = Math.round((1 - advF) * 50 * (0.86 + r() * 0.2));
  return { adv, dec, unch: Math.max(50 - adv - dec, 0) };
}

export interface FlowRow {
  label: string;
  fii: number;
  dii: number;
}

export function getFlows(): { today: FlowRow; history: { label: string; value: number }[] } {
  const day = latestTradingDayKey();
  const r = rngOf(`flows:${day}`);
  const fii = Math.round((r() - 0.5) * 2 * 4150);
  const dii = Math.round((r() - 0.5) * 2 * 3480);
  const history: { label: string; value: number }[] = [];
  let k = day;
  for (let i = 0; i < 7; i++) {
    const hr = rngOf(`flows:${k}`);
    history.unshift({ label: formatDayKey(k), value: Math.round((hr() - 0.5) * 2 * 4150) });
    k = prevTradingDayKey(k);
  }
  return { today: { label: formatDayKey(day), fii, dii }, history };
}

/* ------------------------------------------------------------------ */
/* Overview aggregate                                                  */
/* ------------------------------------------------------------------ */

export interface OverviewIndex {
  symbol: string;
  name: string;
  exch: string;
  price: number;
  chg: number;
  chgPct: number;
  spark: number[];
  prevClose: number;
}

export function getOverview() {
  const status = marketStatus();
  const indices: OverviewIndex[] = INDICES.map((inst) => {
    const q = getSpot(inst.symbol);
    return {
      symbol: inst.symbol,
      name: inst.name,
      exch: inst.exch,
      price: q.price,
      chg: q.chg,
      chgPct: q.chgPct,
      spark: getSpark(inst.symbol),
      prevClose: q.prevClose,
    };
  });
  const chain = getChain("NIFTY");
  return {
    status,
    indices,
    vix: getVix(),
    breadth: getBreadth(),
    flows: getFlows(),
    niftyPcr: chain.pcrOi,
    bankPcr: getChain("BANKNIFTY").pcrOi,
    niftyMaxPain: chain.maxPain,
    asOf: status.timeLabel,
  };
}

/** Compact quote list for watchlist rows. */
export function getQuotes(symbols: string[]) {
  return symbols.map((s) => {
    const inst = instrument(s);
    const q = getSpot(inst.symbol);
    return {
      symbol: inst.symbol,
      name: inst.name,
      kind: inst.kind,
      lot: inst.lot,
      price: q.price,
      chg: q.chg,
      chgPct: q.chgPct,
      open: q.open,
      high: q.high,
      low: q.low,
    };
  });
}

export { instrument, probAbove };
export const universe = { indices: INDICES, stocks: STOCKS, all: ALL };
