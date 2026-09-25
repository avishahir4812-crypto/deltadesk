# DeltaDesk — F&O Derivatives Research Terminal

A production-style research terminal for Indian index & stock derivatives, built to
demonstrate end-to-end product engineering in the F&O analytics domain:

- **Live option chains** — strike-level OI, ΔOI, volume, IV smile, Black–Scholes Greeks,
  PCR, Max Pain, OI walls (support/resistance), expected-move analytics.
- **Derivatives analytics** — OI profiles, intraday PCR, IV Rank, futures build-up
  quadrants (long/short build-up, covering, unwinding), institutional flow tracking.
- **Strategy Lab** — multi-leg payoff at expiry with breakevens, open-ended risk
  detection, probability-of-profit via lognormal simulation, net Greeks, indicative
  margin, and one-click presets priced off the live chain.
- **AI research copilot** — intent-routed analyst grounded in the same live market state
  the terminal renders, plus an auto-generated daily desk brief persisted in Postgres.
- **Desk workspace** — watchlist, research notes and a saved-strategy book, all backed
  by PostgreSQL via Drizzle ORM.

All quotes are produced by a **deterministic intraday market simulation** (seeded per
symbol + trading day) so the app is fully self-contained and every viewer sees the same
market. The analytics math is real. No exchange feed is connected; nothing here is
investment advice.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4, custom design tokens, Lucide icons |
| Charts | Hand-built responsive SVG (candles, OI profile, gauges, payoff) — zero chart deps |
| Data | Route handlers in `app/api/*`; domain engine in `src/lib/market/*` |
| DB | PostgreSQL + Drizzle ORM (`pg` driver), zod-validated writes |
| Automation | `vercel.json` cron → `/api/cron/brief` (N8N-style scheduled brief) |

## Where things live

```
src/
  lib/market/        rng, IST calendar, instrument universe, Black–Scholes, chain engine
  lib/ai/            copilot intents + daily-brief composer
  db/                schema, pool, self-migration (advisory-locked DDL), idempotent seed
  app/api/           market/*, watchlist, strategies, notes, ai/chat, ai/brief, cron/brief
  app/(pages)        overview / chain / analytics / strategy / research / notes
  components/        design system, charts, chain table, command palette (⌘K)
```

## Run locally

```bash
npm install
createdb app_db  # or any Postgres 13+
echo 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db' > .env
npm run dev
```

Tables are created automatically on first request (self-migration) and seeded with
representative content. `npx drizzle-kit push` also works if you prefer explicit DDL.

## Deploy to Vercel (one shot)

1. Push this repo and import it in Vercel — framework preset is auto-detected, no
   custom build settings needed.
2. Add ONE env var holding any pooled Postgres connection string — `DATABASE_URL`,
   `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` (Neon, Supabase, Vercel Postgres,
   RDS all work; SSL is auto-configured for non-local hosts, certificates are not
   required).
3. Deploy. On first request the app self-migrates tables and seeds demo content via
   idempotent DDL — no `drizzle-kit` step, no build-time database dependency.
   `/api/health` reports `db: connected`.

If the env var is missing or wrong, **nothing crashes**: the build passes, pages
render, and market data, chains, analytics, strategy lab and the AI copilot keep
working; only persistence-backed features (watchlist, notes, saved strategies,
chat history, brief archive) degrade to clean in-memory responses.

> Optional: set `CRON_SECRET` to protect `/api/cron/brief` (called daily at 09:10
> IST per `vercel.json`). Leaving it unset keeps the endpoint open, which is fine
> for a demo.
