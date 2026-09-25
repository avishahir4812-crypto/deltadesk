/**
 * Idempotent representative-content seeding. Runs on first API access (and is
 * safe under concurrent calls thanks to unique constraints + count guards).
 */

import { db } from "./index";
import { ensureTables } from "./migrate";
import { briefs, notes, strategies, watchlist } from "./schema";
import { buildBrief } from "@/lib/ai/brief";
import { getChain } from "@/lib/market/engine";
import { latestTradingDayKey, prevTradingDayKey } from "@/lib/market/time";
import { count } from "drizzle-orm";
import type { StrategyLeg } from "@/lib/types";

let seeded: Promise<boolean> | null = null;

const NOTE_DOCS: { title: string; body: string; tags: string[]; pinned: boolean }[] = [
  {
    title: "NIFTY weekly playbook — trading the OI walls",
    pinned: true,
    tags: ["nifty", "open-interest", "weekly"],
    body: [
      "Framework for the weekly expiry on NIFTY:",
      "",
      "1. Mark the largest Call and Put OI strikes at 09:20 — these are the day-one walls.",
      "2. Walls migrate, don't just hold: if the 24,400 CE wall starts shedding OI while price pushes, writers are exiting — stop fading the move.",
      "3. Pinning: on low-news sessions into expiry, price gravitates toward Max Pain. Fading extensions back toward MP works until breadth expands > 60/40.",
      "4. Never short naked options on expiry day; gamma makes stop-losses theoretical.",
    ].join("\n"),
  },
  {
    title: "Iron condor risk checklist",
    pinned: false,
    tags: ["options", "risk", "checklist"],
    body: [
      "Before putting on a short iron condor:",
      "",
      "- [ ] IV Rank ≥ 50 (premium worth selling)",
      "- [ ] Short strikes at/behind the OI walls, wings exactly 2 strikes out",
      "- [ ] Credit ≥ 25% of wing width, else skip",
      "- [ ] Invalidation = 15-min close beyond a short strike, pre-written in the order ticket",
      "- [ ] Position sized so max loss ≤ 1% of capital",
      "- [ ] No event risk (RBI/Fed/election) inside the holding window",
    ].join("\n"),
  },
  {
    title: "Reading futures build-up without fooling yourself",
    pinned: false,
    tags: ["futures", "oi", "education"],
    body: [
      "Price ↑ + OI ↑ = long build-up — but only meaningful above ~2% OI expansion; below that it is noise and rolls.",
      "Price ↑ + OI ↓ = short covering — rallies that die once the covering is done; don't chase the second leg.",
      "Price ↓ + OI ↑ = short build-up — the most reliable continuation signal in liquid F&O names.",
      "Price ↓ + OI ↓ = long unwinding — sell-offs that exhaust themselves; look for where OI stabilises.",
      "",
      "Always cross-check with cash-market breadth; OI without breadth is positioning, not conviction.",
    ].join("\n"),
  },
];

async function seedWatchlist() {
  await db!
    .insert(watchlist)
    .values([
      { symbol: "NIFTY", label: "NIFTY 50", kind: "index", sort: 1 },
      { symbol: "BANKNIFTY", label: "NIFTY BANK", kind: "index", sort: 2 },
      { symbol: "RELIANCE", label: "Reliance Industries", kind: "stock", sort: 3 },
      { symbol: "TATAMOTORS", label: "Tata Motors", kind: "stock", sort: 4 },
    ])
    .onConflictDoNothing();
}

async function seedStrategies() {
  const [{ value }] = await db!.select({ value: count() }).from(strategies);
  if (value > 0) return;
  const nifty = getChain("NIFTY");
  const bank = getChain("BANKNIFTY");
  const nRow = (k: number) => nifty.strikes.find((s) => s.strike === k) ?? nifty.strikes[0];
  const bRow = (k: number) => bank.strikes.find((s) => s.strike === k) ?? bank.strikes[0];

  const nSp = nifty.supports[0] ?? nifty.atm - 200;
  const nRs = nifty.resistances[0] ?? nifty.atm + 200;
  const condorLegs: StrategyLeg[] = [
    { kind: "PE", side: "SELL", strike: nSp, lots: 1, entry: nRow(nSp).pe.ltp },
    { kind: "PE", side: "BUY", strike: nSp - 100, lots: 1, entry: nRow(nSp - 100).pe.ltp },
    { kind: "CE", side: "SELL", strike: nRs, lots: 1, entry: nRow(nRs).ce.ltp },
    { kind: "CE", side: "BUY", strike: nRs + 100, lots: 1, entry: nRow(nRs + 100).ce.ltp },
  ];
  const bAtm = bank.atm;
  const bTgt = bank.resistances[0] ?? bank.atm + 400;
  const spreadLegs: StrategyLeg[] = [
    { kind: "CE", side: "BUY", strike: bAtm, lots: 1, entry: bRow(bAtm).ce.ltp },
    { kind: "CE", side: "SELL", strike: bTgt, lots: 1, entry: bRow(bTgt).ce.ltp },
  ];

  await db!.insert(strategies).values([
    {
      name: "NIFTY Iron Condor — range week",
      symbol: "NIFTY",
      expiry: nifty.expiry,
      legs: condorLegs,
      thesis:
        "Short strikes sit on the largest OI walls with PCR near 1 and VIX falling. Credit-targeted, defined wings; invalidation on a 15-min close beyond either wall.",
    },
    {
      name: "BANKNIFTY Bull Call Spread",
      symbol: "BANKNIFTY",
      expiry: bank.expiry,
      legs: spreadLegs,
      thesis:
        "Banking leadership with futures adding longs; defined-risk way to express the move into the call wall without paying naked ATM theta.",
    },
  ]);
}

async function seedNotes() {
  const [{ value }] = await db!.select({ value: count() }).from(notes);
  if (value > 0) return;
  await db!.insert(notes).values(NOTE_DOCS);
}

/** Persist briefs for the last two sessions so the archive isn't empty. */
async function seedBriefArchive() {
  const today = latestTradingDayKey();
  const d1 = prevTradingDayKey(today);
  const d2 = prevTradingDayKey(d1);
  for (const day of [d2, d1]) {
    await db!
      .insert(briefs)
      .values({ day, kind: "daily", payload: buildBrief(day) })
      .onConflictDoNothing();
  }
}

export function ensureSeeded(): Promise<boolean> {
  if (!db) return Promise.resolve(false);
  if (!seeded) {
    seeded = (async () => {
      try {
        const ok = await ensureTables();
        if (!ok) throw new Error("tables unavailable");
        await seedWatchlist();
        await seedNotes();
        await seedStrategies();
        await seedBriefArchive();
        return true;
      } catch (err) {
        console.error("[db] seed failed:", err);
        seeded = null;
        return false;
      }
    })();
  }
  return seeded;
}
