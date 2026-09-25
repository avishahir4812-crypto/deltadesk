/**
 * Research copilot — intent-routed analyst over the live market engine.
 * Every figure quoted comes from the current chain/futures state, so answers
 * are internally consistent with the terminal. The interface mirrors what a
 * production build would do: retrieve structured market context → compose.
 */

import {
  getBuildup,
  getChain,
  getOverview,
  getSpot,
  getVix,
} from "@/lib/market/engine";
import { fmtIN, fmtOi, fmtPct } from "@/lib/format";
import { INDICES, STOCKS } from "@/lib/market/universe";

export interface AiCard {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "flat" | "warn" | "brand";
}

export interface AiReply {
  reply: string;
  cards: AiCard[];
}

const ALIASES: [RegExp, string][] = [
  [/bank\s?nifty|bnf/i, "BANKNIFTY"],
  [/fin\s?nifty|finnifty/i, "FINNIFTY"],
  [/midcap|midcp/i, "MIDCPNIFTY"],
  [/sensex/i, "SENSEX"],
  [/nifty/i, "NIFTY"],
  [/reliance/i, "RELIANCE"],
  [/hdfc/i, "HDFCBANK"],
  [/icici/i, "ICICIBANK"],
  [/sbi|state bank/i, "SBIN"],
  [/tcs|tata consultancy/i, "TCS"],
  [/infosys|infy/i, "INFY"],
  [/tata motors|tatamotors/i, "TATAMOTORS"],
  [/bajaj/i, "BAJFINANCE"],
  [/axis/i, "AXISBANK"],
  [/larsen|l&t|\blt\b/i, "LT"],
  [/maruti/i, "MARUTI"],
  [/kotak/i, "KOTAKBANK"],
];

function extractSymbol(q: string, fallback = "NIFTY"): string {
  for (const [re, sym] of ALIASES) if (re.test(q)) return sym;
  for (const i of [...INDICES, ...STOCKS]) {
    if (q.toUpperCase().includes(i.symbol)) return i.symbol;
  }
  return fallback;
}

const tone = (v: number): AiCard["tone"] => (v > 0 ? "up" : v < 0 ? "down" : "flat");

function asOf(): string {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(11, 16) + " IST";
}

/* ------------------------------ intents ------------------------------ */

function marketSummary(): AiReply {
  const o = getOverview();
  const up = [...o.indices].sort((a, b) => b.chgPct - a.chgPct);
  const breadth = o.breadth;
  const lines = o.indices.map(
    (i) =>
      `- **${i.name}** ${fmtIN(i.price)} (${fmtPct(i.chgPct)})`
  );
  return {
    reply:
      `**Market snapshot — ${asOf()}**\n` +
      lines.join("\n") +
      `\n\nBreadth is ${breadth.adv} advances / ${breadth.dec} declines` +
      `${breadth.adv > breadth.dec ? ", a constructive tape" : breadth.adv < breadth.dec ? ", a weak tape" : ", an even tape"}. ` +
      `India VIX is at ${o.vix.value} (${fmtPct(o.vix.chgPct)}), NIFTY PCR at ${o.niftyPcr} and Max Pain near ${fmtIN(o.niftyMaxPain, 0)}. ` +
      `FII cash flow today: ${o.flows.today.fii >= 0 ? "+" : "−"}₹${fmtIN(Math.abs(o.flows.today.fii), 0)} Cr; DII: ${o.flows.today.dii >= 0 ? "+" : "−"}₹${fmtIN(Math.abs(o.flows.today.dii), 0)} Cr.\n\n` +
      `Leader: **${up[0].name}**. Laggard: **${up[up.length - 1].name}**.`,
    cards: [
      { label: "NIFTY PCR (OI)", value: String(o.niftyPcr), sub: o.niftyPcr > 1 ? "Put-heavy" : "Call-heavy", tone: o.niftyPcr > 1 ? "up" : "warn" },
      { label: "India VIX", value: String(o.vix.value), sub: fmtPct(o.vix.chgPct), tone: o.vix.chg <= 0 ? "up" : "warn" },
      { label: "Adv / Dec", value: `${o.breadth.adv}/${o.breadth.dec}`, tone: o.breadth.adv >= o.breadth.dec ? "up" : "down" },
      { label: "FII cash", value: `${o.flows.today.fii >= 0 ? "+" : "−"}${fmtIN(Math.abs(o.flows.today.fii), 0)} Cr`, tone: tone(o.flows.today.fii) },
    ],
  };
}

function pcrAnswer(sym: string): AiReply {
  const c = getChain(sym);
  const read =
    c.pcrOi >= 1.3 ? "heavily put-written — writers are confident, dips may find support, but >1.3 can also cap upside as calls get sold into rallies" :
    c.pcrOi >= 0.9 ? "balanced — neither side is stretched; follow the OI walls" :
    "call-heavy — upside supply is building; rallies can stall at call walls";
  return {
    reply:
      `**${c.name} — Put-Call Ratio (${c.expiryLabel}, DTE ${c.dte})**\n\n` +
      `- PCR (OI): **${c.pcrOi}** — total Put OI ${fmtOi(c.totPeOi)} vs Call OI ${fmtOi(c.totCeOi)}\n` +
      `- PCR (Volume): **${c.pcrVol}** — today's traded mix\n\n` +
      `Reading: positioning is ${read}. PCR is a positioning gauge, not a timing signal — combine it with the Call wall at ${fmtIN(c.resistances[0] ?? c.atm, 0)} and the Put wall at ${fmtIN(c.supports[0] ?? c.atm, 0)}.`,
    cards: [
      { label: "PCR (OI)", value: String(c.pcrOi), tone: c.pcrOi >= 1 ? "up" : "warn" },
      { label: "PCR (Vol)", value: String(c.pcrVol) },
      { label: "Max Pain", value: fmtIN(c.maxPain, 0), sub: `${c.maxPain > c.spot ? "above" : "below"} spot` },
      { label: "ATM IV", value: `${c.atmIv}%`, sub: `IVR ${c.ivr}` },
    ],
  };
}

function maxPainAnswer(sym: string): AiReply {
  const c = getChain(sym);
  const dist = ((c.maxPain - c.spot) / c.spot) * 100;
  return {
    reply:
      `**Max Pain — ${c.name} ${c.expiryLabel} expiry**\n\n` +
      `Max Pain sits at **${fmtIN(c.maxPain, 0)}**, ${Math.abs(dist).toFixed(2)}% ${dist >= 0 ? "above" : "below"} the current spot of ${fmtIN(c.spot)}. ` +
      `It is the settlement level at which the total intrinsic payout to option *buyers* is minimised — i.e. where writers (typically institutions) lose the least.\n\n` +
      `- Into expiry, price often gravitates toward Max Pain ("pinning"), especially on low-news days\n` +
      `- The pull is a tendency, not a law — trending days ignore it\n` +
      `- Watch the straddle (${fmtIN(c.straddle)}) for the market's own expected range`,
    cards: [
      { label: "Max Pain", value: fmtIN(c.maxPain, 0), tone: dist >= 0 ? "up" : "down" },
      { label: "Distance", value: `${Math.abs(dist).toFixed(2)}%`, sub: dist >= 0 ? "pull up" : "pull down" },
      { label: "DTE", value: String(c.dte) },
      { label: "Straddle", value: fmtIN(c.straddle), sub: `±${c.expectedMovePct}%` },
    ],
  };
}

function levelsAnswer(sym: string): AiReply {
  const c = getChain(sym);
  return {
    reply:
      `**${c.name} — OI-derived levels (${c.expiryLabel})**\n\n` +
      `- **Resistance**: ${c.resistances.map((r) => fmtIN(r, 0)).join(" / ")} — the largest Call OI walls; writers defend these\n` +
      `- **Support**: ${c.supports.map((s) => fmtIN(s, 0)).join(" / ")} — the largest Put OI walls\n\n` +
      `Spot ${fmtIN(c.spot)} is ${c.spot > c.maxPain ? "above" : "below"} Max Pain (${fmtIN(c.maxPain, 0)}). ` +
      `A decisive move through a wall with rising futures OI often forces writer unwinding — that's when breakout days happen. Level shifts matter more than the levels themselves.`,
    cards: [
      { label: "R1 (Call wall)", value: fmtIN(c.resistances[0] ?? c.atm, 0), tone: "down" },
      { label: "S1 (Put wall)", value: fmtIN(c.supports[0] ?? c.atm, 0), tone: "up" },
      { label: "Max Pain", value: fmtIN(c.maxPain, 0) },
      { label: "Spot", value: fmtIN(c.spot), sub: fmtPct(c.chgPct), tone: tone(c.chgPct) },
    ],
  };
}

function buildupAnswer(): AiReply {
  const rows = getBuildup();
  const longs = rows.filter((r) => r.cls === "Long Buildup").slice(0, 3);
  const shorts = rows.filter((r) => r.cls === "Short Buildup").slice(0, 3);
  const line = (r: (typeof rows)[number]) =>
    `- **${r.name}** ${fmtPct(r.chgPct)} with OI ${fmtPct(r.oiChgPct)} (${r.cls})`;
  const idxLong = rows.filter((r) => r.kind === "index" && r.oiChgPct > 0 && r.chgPct > 0).length;
  const idxShort = rows.filter((r) => r.kind === "index" && r.oiChgPct > 0 && r.chgPct < 0).length;
  return {
    reply:
      `**Futures OI build-up — ${asOf()}**\n\n` +
      `Price ↑ + OI ↑ = fresh longs; Price ↓ + OI ↑ = fresh shorts; Price ↑ + OI ↓ = short covering; Price ↓ + OI ↓ = long unwinding.\n\n` +
      `**Long build-up**\n${longs.map(line).join("\n") || "- None material"}\n\n` +
      `**Short build-up**\n${shorts.map(line).join("\n") || "- None material"}\n\n` +
      (idxLong > idxShort
        ? "Index futures are adding longs — the derivatives desk is leaning with the trend."
        : idxShort > idxLong
          ? "Index futures are adding shorts — supply is coming in at higher levels."
          : "Index futures positioning is mixed — wait for expansion."),
    cards: rows.slice(0, 4).map((r) => ({
      label: r.symbol,
      value: fmtPct(r.chgPct),
      sub: `OI ${fmtPct(r.oiChgPct)} · ${r.cls}`,
      tone: r.cls === "Long Buildup" ? "up" : r.cls === "Short Buildup" ? "down" : "flat",
    })),
  };
}

function volatilityAnswer(sym: string): AiReply {
  const c = getChain(sym);
  const vix = getVix();
  const ivrRead = c.ivr >= 60 ? "elevated — option selling has an edge, defined-risk structures preferred" : c.ivr <= 35 ? "cheap — premium buying is viable, debit spreads/working with trends" : "neutral — no strong volatility edge either way";
  return {
    reply:
      `**Volatility — ${c.name}**\n\n` +
      `- ATM IV: **${c.atmIv}%** | IV Rank (30d): **${c.ivr}**\n` +
      `- India VIX: **${vix.value}** (${fmtPct(vix.chgPct)})\n` +
      `- The ${c.expiryLabel} ATM straddle costs **${fmtIN(c.straddle)}** ≈ **±${c.expectedMovePct}%** — the market's own expected move\n\n` +
      `Regime: ${ivrRead}. The straddle breakevens are your sanity check before any expiry trade.`,
    cards: [
      { label: "ATM IV", value: `${c.atmIv}%` },
      { label: "IV Rank", value: `${c.ivr}`, sub: "of 30d range", tone: c.ivr >= 60 ? "warn" : "flat" },
      { label: "India VIX", value: String(vix.value), sub: fmtPct(vix.chgPct), tone: vix.chg <= 0 ? "up" : "warn" },
      { label: "Expected move", value: `±${c.expectedMovePct}%`, sub: `${c.dte} DTE` },
    ],
  };
}

function strategyAnswer(sym: string): AiReply {
  const c = getChain(sym);
  const step = c.step;
  const upTrend = c.chgPct >= 0.45;
  const downTrend = c.chgPct <= -0.45;
  const quiet = Math.abs(c.chgPct) < 0.35 && c.pcrOi >= 0.8 && c.pcrOi <= 1.3;

  const row = (k: number) => c.strikes.find((s) => s.strike === k) ?? c.strikes[0];

  if (quiet) {
    const sp = c.supports[0] ?? c.atm - 2 * step;
    const rs = c.resistances[0] ?? c.atm + 2 * step;
    const wing = 2 * step;
    const credit = row(sp).pe.ltp + row(rs).ce.ltp - row(sp - wing).pe.ltp - row(rs + wing).ce.ltp;
    return {
      reply:
        `**Regime read: range-bound tape** — ${c.name} ${fmtPct(c.chgPct)}, PCR ${c.pcrOi}, VIX cooling. Writers are in control between the walls.\n\n` +
        `**Structure: Short Iron Condor (${c.expiryLabel})**\n` +
        `- Sell ${fmtIN(rs, 0)} CE + Buy ${fmtIN(rs + wing, 0)} CE\n` +
        `- Sell ${fmtIN(sp, 0)} PE + Buy ${fmtIN(sp - wing, 0)} PE\n` +
        `- Net credit ≈ **${fmtIN(Math.max(credit, 1))}**/lot · Max risk ≈ ${fmtIN(wing - Math.max(credit, 1))}/lot\n\n` +
        `Rationale: short strikes sit at the largest OI walls. **Invalidation:** a 15-min close beyond ${fmtIN(rs, 0)} or ${fmtIN(sp, 0)} — exit, don't average. The Strategy Lab can price this exactly.`,
      cards: [
        { label: "Structure", value: "Iron Condor", tone: "brand" },
        { label: "Net credit", value: `≈ ${fmtIN(Math.max(credit, 1))}` },
        { label: "Risk : Reward", value: `${((wing - Math.max(credit, 1)) / Math.max(credit, 1)).toFixed(1)} : 1`, tone: "warn" },
        { label: "Profit zone", value: `${fmtIN(sp, 0)}–${fmtIN(rs, 0)}` },
      ],
    };
  }

  if (upTrend) {
    const buyK = c.atm;
    const sellK = c.resistances[0] ?? c.atm + 3 * step;
    const debit = row(buyK).ce.ltp - row(sellK).ce.ltp;
    return {
      reply:
        `**Regime read: bullish trend day** — ${c.name} ${fmtPct(c.chgPct)}, futures adding longs, calls writing overhead only at ${fmtIN(sellK, 0)}.\n\n` +
        `**Structure: Bull Call Spread (${c.expiryLabel})**\n` +
        `- Buy ${fmtIN(buyK, 0)} CE · Sell ${fmtIN(sellK, 0)} CE\n` +
        `- Net debit ≈ **${fmtIN(Math.max(debit, 1))}**/lot · Max gain ≈ ${fmtIN(sellK - buyK - Math.max(debit, 1))}/lot\n\n` +
        `Rationale: defined risk, theta cost is capped, target aligns with the call wall. **Invalidation:** spot back below ${fmtIN(c.supports[0] ?? c.atm - step, 0)}.`,
      cards: [
        { label: "Structure", value: "Bull Call Spread", tone: "up" },
        { label: "Net debit", value: `≈ ${fmtIN(Math.max(debit, 1))}` },
        { label: "Max gain", value: `≈ ${fmtIN(Math.max(sellK - buyK - Math.max(debit, 1), 1))}` },
        { label: "Breakeven", value: fmtIN(buyK + Math.max(debit, 1), 0) },
      ],
    };
  }

  if (downTrend) {
    const buyK = c.atm;
    const sellK = c.supports[0] ?? c.atm - 3 * step;
    const debit = row(buyK).pe.ltp - row(sellK).pe.ltp;
    return {
      reply:
        `**Regime read: bearish trend day** — ${c.name} ${fmtPct(c.chgPct)}, shorts adding, put writers shifting lower.\n\n` +
        `**Structure: Bear Put Spread (${c.expiryLabel})**\n` +
        `- Buy ${fmtIN(buyK, 0)} PE · Sell ${fmtIN(sellK, 0)} PE\n` +
        `- Net debit ≈ **${fmtIN(Math.max(debit, 1))}**/lot · Max gain ≈ ${fmtIN(buyK - sellK - Math.max(debit, 1))}/lot\n\n` +
        `Rationale: defined risk into the put wall at ${fmtIN(sellK, 0)}. **Invalidation:** reclaim of ${fmtIN(c.resistances[0] ?? c.atm + step, 0)}.`,
      cards: [
        { label: "Structure", value: "Bear Put Spread", tone: "down" },
        { label: "Net debit", value: `≈ ${fmtIN(Math.max(debit, 1))}` },
        { label: "Max gain", value: `≈ ${fmtIN(Math.max(buyK - sellK - Math.max(debit, 1), 1))}` },
        { label: "Breakeven", value: fmtIN(buyK - Math.max(debit, 1), 0) },
      ],
    };
  }

  return {
    reply:
      `**No clean edge right now** on ${c.name} — move is ${fmtPct(c.chgPct)} with PCR ${c.pcrOi}, a mixed tape.\n\n` +
      `Disciplined options:\n` +
      `- Stand aside and let the OI walls declare (current range ${fmtIN(c.supports[0] ?? c.atm - step, 0)} – ${fmtIN(c.resistances[0] ?? c.atm + step, 0)})\n` +
      `- If forced: trade *inside* the range with defined-risk spreads sized to the ±${c.expectedMovePct}% expected move\n\n` +
      `The best trade on indecisive days is usually position size.`,
    cards: [
      { label: "Bias", value: "Neutral", tone: "flat" },
      { label: "Expected move", value: `±${c.expectedMovePct}%` },
      { label: "PCR", value: String(c.pcrOi) },
      { label: "IVR", value: String(c.ivr) },
    ],
  };
}

function greeksAnswer(q: string): AiReply {
  const which = /theta/i.test(q) ? "theta" : /gamma/i.test(q) ? "gamma" : /vega/i.test(q) ? "vega" : /delta/i.test(q) ? "delta" : "all";
  const c = getChain("NIFTY");
  const atmRow = c.strikes.find((s) => s.strike === c.atm)!;
  const expl: Record<string, string> = {
    delta: `**Delta** — option price sensitivity to a 1-pt move in the underlying. The ${fmtIN(c.atm, 0)} NIFTY CE currently carries Δ ${atmRow.ce.delta.toFixed(2)}: a 50-pt NIFTY move ≈ ₹${(50 * atmRow.ce.delta).toFixed(1)} on the premium, before gamma kicks in. ITM → toward 1, far OTM → toward 0. Delta is also a rough proxy for the probability of expiring ITM.`,
    theta: `**Theta** — time decay per day. The ATM ${c.expiryLabel} straddle is bleeding ≈ **₹${fmtIN(Math.abs(atmRow.ce.theta + atmRow.pe.theta), 1)}/day** right now. Theta accelerates into expiry (roughly ∝ 1/√T) — which is why expiry-week selling works until it spectacularly doesn't.`,
    gamma: `**Gamma** — how fast delta changes. Highest at ATM, into expiry. Long gamma = you get longer as price moves your way (long options); short gamma = the opposite (short options, iron condors). Gamma risk is why short straddles gap through breakevens on trending days.`,
    vega: `**Vega** — P&L per 1-pt change in IV. ATM ${c.expiryLabel} vega ≈ ₹${fmtIN(atmRow.ce.vega, 1)} per vol point, per leg. Buying options into an event buys vega — if IV is already pumped (IVR ${c.ivr}), you're paying up for the same move.`,
    all: `**Greeks at the ATM ${fmtIN(c.atm, 0)} strike (${c.expiryLabel})** — Δ ${atmRow.ce.delta.toFixed(2)} / ${atmRow.pe.delta.toFixed(2)}, Θ ₹${fmtIN(atmRow.ce.theta, 1)} & ₹${fmtIN(atmRow.pe.theta, 1)} per day, Vega ₹${fmtIN(atmRow.ce.vega, 1)} per vol pt, Γ ${atmRow.ce.gamma.toFixed(5)}.\n\nAsk me about any one of them ("explain theta") for the intuition.`,
  };
  return {
    reply: expl[which],
    cards: [
      { label: "ATM Δ (CE/PE)", value: `${atmRow.ce.delta.toFixed(2)} / ${atmRow.pe.delta.toFixed(2)}` },
      { label: "Θ / day", value: `₹${fmtIN(Math.abs(atmRow.ce.theta), 1)}`, tone: "warn" },
      { label: "Vega / vol pt", value: `₹${fmtIN(atmRow.ce.vega, 1)}` },
      { label: "ATM IV", value: `${c.atmIv}%` },
    ],
  };
}

function quoteAnswer(sym: string): AiReply {
  const q = getSpot(sym);
  return {
    reply:
      `**${q.name}** is at **${fmtIN(q.price)}** (${fmtPct(q.chgPct)}, ${q.chg >= 0 ? "+" : "−"}${fmtIN(Math.abs(q.chg))}) as of ${asOf()}.\n` +
      `Day range ${fmtIN(q.low)} – ${fmtIN(q.high)}; opened ${fmtIN(q.open)} against a previous close of ${fmtIN(q.prevClose)}.`,
    cards: [
      { label: q.symbol, value: fmtIN(q.price), sub: fmtPct(q.chgPct), tone: tone(q.chgPct) },
      { label: "Day high", value: fmtIN(q.high), tone: "up" },
      { label: "Day low", value: fmtIN(q.low), tone: "down" },
      { label: "Prev close", value: fmtIN(q.prevClose) },
    ],
  };
}

const HELP: AiReply = {
  reply:
    `I'm the research copilot for this terminal — I read the live option chain, futures OI and volatility state, and answer in numbers.\n\n` +
    `Try:\n` +
    `- "Summarise today's market"\n` +
    `- "Where is NIFTY support and resistance?"\n` +
    `- "Suggest a strategy for BANKNIFTY"\n` +
    `- "Explain PCR" or "What is max pain?"\n` +
    `- "How is the volatility setup on FINNIFTY?"\n` +
    `- "Top OI build-ups right now"`,
  cards: [
    { label: "Data", value: "Live chain + futures", tone: "brand" },
    { label: "Coverage", value: `${INDICES.length} indices · ${STOCKS.length} F&O stocks` },
    { label: "Latency", value: "12s refresh" },
  ],
};

/* ------------------------------ routing ------------------------------ */

export function answer(question: string): AiReply {
  const q = question.trim();
  if (!q) return HELP;
  const sym = extractSymbol(q);

  if (/^(hi|hello|hey|help|what can you do|who are you)\b/i.test(q) || q.length < 3) return HELP;
  if (/thank/i.test(q)) return { reply: "Anytime. If you want a second opinion on a structure, paste the strikes and I'll price the risk.", cards: [] };
  if (/max\s?pain/i.test(q)) return maxPainAnswer(sym);
  if (/put.?call|\bpcr\b/i.test(q)) return pcrAnswer(sym);
  if (/support|resistance|levels|wall/i.test(q)) return levelsAnswer(sym);
  if (/build\s?up|open interest|\boi\b|long buildup|short buildup/i.test(q)) return buildupAnswer();
  if (/iv|vix|volatil|implied|straddle|expected move/i.test(q) && !/strateg/i.test(q)) return volatilityAnswer(sym);
  if (/theta|delta|gamma|vega|greek/i.test(q)) return greeksAnswer(q);
  if (/strateg|trade|view|bias|condor|spread|strangle|hedge|should i (buy|sell)|sideways/i.test(q)) return strategyAnswer(sym);
  if (/summary|summarise|recap|market|today|how.*(nifty|market|doing)|overview/i.test(q)) return marketSummary();
  if (/price|quote|ltp|level of|where is/i.test(q)) return quoteAnswer(sym);
  if (/expiry|dte|rollover/i.test(q)) {
    const c = getChain(sym);
    return {
      reply:
        `**Expiries — ${c.name}**\n\n` +
        c.expiries.map((e) => `- **${e.label}** (${e.kind === "W" ? "Weekly" : "Monthly"}) — ${e.dte} day${e.dte === 1 ? "" : "s"} out`).join("\n") +
        `\n\nTheta accelerates hardest in the final two sessions — that is when OI walls migrate and pinning near Max Pain (${fmtIN(c.maxPain, 0)}) shows up most clearly.`,
      cards: c.expiries.slice(0, 4).map((e) => ({ label: e.label, value: `${e.dte}d`, sub: e.kind === "W" ? "Weekly" : "Monthly" })),
    };
  }
  return {
    reply:
      `I didn't catch a market question in that. I can read the live chain — ask me about **support/resistance**, **PCR**, **max pain**, **volatility/IV**, **OI build-ups**, or say **"suggest a strategy for NIFTY"**.`,
    cards: HELP.cards,
  };
}
