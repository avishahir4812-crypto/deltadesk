/**
 * Auto-generated pre-open / EOD research brief. In production this is the
 * artifact a scheduled automation (Vercel Cron / N8N) would assemble and push
 * to a desk channel; here it is generated on demand and persisted in Postgres.
 */

import { getBuildup, getChain, getFlows, getOverview, getVix } from "@/lib/market/engine";
import { formatDayKey, latestTradingDayKey } from "@/lib/market/time";
import { fmtIN, fmtOi, fmtPct } from "@/lib/format";

export interface BriefSection {
  heading: string;
  bullets: string[];
}

export interface Brief {
  day: string;
  title: string;
  lead: string;
  generatedAt: string;
  sections: BriefSection[];
}

export function buildBrief(dayKey?: string): Brief {
  const day = dayKey ?? latestTradingDayKey();
  const o = getOverview();
  const vix = getVix();
  const flows = getFlows();
  const nifty = getChain("NIFTY");
  const bank = getChain("BANKNIFTY");
  const rows = getBuildup();

  const niftyIdx = o.indices[0];
  const tone = niftyIdx.chgPct > 0.4 ? "constructive" : niftyIdx.chgPct < -0.4 ? "defensive" : "balanced";
  const longs = rows.filter((r) => r.cls === "Long Buildup").length;
  const shorts = rows.filter((r) => r.cls === "Short Buildup").length;
  const topAdd = [...rows].sort((a, b) => Math.abs(b.oiChgPct) - Math.abs(a.oiChgPct)).slice(0, 3);

  const sections: BriefSection[] = [
    {
      heading: "Market structure",
      bullets: [
        `Tape tone is ${tone}: NIFTY ${fmtPct(niftyIdx.chgPct)} at ${fmtIN(niftyIdx.price)}, BANKNIFTY ${fmtPct(o.indices[1].chgPct)}; breadth ${o.breadth.adv}/${o.breadth.dec} (adv/dec).`,
        `India VIX ${vix.value} (${fmtPct(vix.chgPct)}) — ${vix.chg <= 0 ? "vol supply returning, writers comfortable" : "vol bid, hedgers active, respect gap risk"}.`,
        `Institutional flows: FII cash ${flows.today.fii >= 0 ? "+" : "−"}₹${fmtIN(Math.abs(flows.today.fii), 0)} Cr, DII ${flows.today.dii >= 0 ? "+" : "−"}₹${fmtIN(Math.abs(flows.today.dii), 0)} Cr.`,
      ],
    },
    {
      heading: "Derivatives positioning",
      bullets: [
        `Futures build-up: ${longs} names in long build-up vs ${shorts} in short build-up (${longs > shorts ? "net bullish OI expansion" : shorts > longs ? "net bearish OI expansion" : "no dominant OI theme"}).`,
        `Largest OI moves: ${topAdd.map((r) => `${r.symbol} OI ${fmtPct(r.oiChgPct)} (${r.cls.toLowerCase()})`).join("; ")}.`,
        `NIFTY weekly PCR ${nifty.pcrOi} (CE OI ${fmtOi(nifty.totCeOi)} / PE OI ${fmtOi(nifty.totPeOi)}); BANKNIFTY monthly PCR ${bank.pcrOi}.`,
        `Max Pain: NIFTY ${fmtIN(nifty.maxPain, 0)} (spot ${fmtIN(nifty.spot)}), BANKNIFTY ${fmtIN(bank.maxPain, 0)} — watch pinning behaviour into expiry.`,
      ],
    },
    {
      heading: "Volatility",
      bullets: [
        `NIFTY ATM IV ${nifty.atmIv}% with IV Rank ${nifty.ivr} — ${nifty.ivr >= 60 ? "premium selling has a statistical edge" : nifty.ivr <= 35 ? "premium buying is viable for directional views" : "mid-range; no vol edge either way"}.`,
        `The ${nifty.expiryLabel} straddle prices an expected move of ±${nifty.expectedMovePct}% (₹${fmtIN(nifty.straddle)}).`,
      ],
    },
    {
      heading: "Key levels",
      bullets: [
        `NIFTY: call walls ${nifty.resistances.map((r) => fmtIN(r, 0)).join(" / ")}; put walls ${nifty.supports.map((s) => fmtIN(s, 0)).join(" / ")}.`,
        `BANKNIFTY: call walls ${bank.resistances.map((r) => fmtIN(r, 0)).join(" / ")}; put walls ${bank.supports.map((s) => fmtIN(s, 0)).join(" / ")}.`,
      ],
    },
    {
      heading: "Strategy lens",
      bullets: [
        Math.abs(niftyIdx.chgPct) < 0.35 && nifty.pcrOi >= 0.8 && nifty.pcrOi <= 1.3
          ? `Range tape: short iron condor between ${fmtIN(nifty.supports[0] ?? nifty.atm, 0)} / ${fmtIN(nifty.resistances[0] ?? nifty.atm, 0)} with wings 2 strikes out; invalidation = 15-min close beyond either wall.`
          : niftyIdx.chgPct >= 0.35
            ? `Trend-up read: bull call spread ${fmtIN(nifty.atm, 0)} / ${fmtIN(nifty.resistances[0] ?? nifty.atm + 150, 0)} CE; risk = net debit, trail below ${fmtIN(nifty.supports[0] ?? nifty.atm - 100, 0)}.`
            : `Trend-down read: bear put spread ${fmtIN(nifty.atm, 0)} / ${fmtIN(nifty.supports[0] ?? nifty.atm - 150, 0)} PE; risk = net debit, trail above ${fmtIN(nifty.resistances[0] ?? nifty.atm + 100, 0)}.`,
        `Size positions so a full stop-out costs ≤ 0.5–1% of capital; avoid naked shorts on expiry day.`,
      ],
    },
    {
      heading: "Risk notes",
      bullets: [
        "All figures on this terminal are from a deterministic simulation built for product demonstration — verify against exchange data before any real trade.",
        "Derivatives involve substantial risk of loss. This brief is research workflow output, not investment advice.",
      ],
    },
  ];

  return {
    day,
    title: `Desk brief · ${formatDayKey(day, true)}`,
    lead: `${tone === "constructive" ? "Bullish drift" : tone === "defensive" ? "Risk-off tone" : "Balanced tape"} — NIFTY ${fmtPct(niftyIdx.chgPct)}, VIX ${vix.value} (${fmtPct(vix.chgPct)}), PCR ${nifty.pcrOi}, FII ${flows.today.fii >= 0 ? "buyers" : "sellers"} ₹${fmtIN(Math.abs(flows.today.fii), 0)} Cr.`,
    generatedAt: new Date().toISOString(),
    sections,
  };
}
