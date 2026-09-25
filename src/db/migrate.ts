import { pool } from "./index";

/**
 * Zero-config migrations: idempotent DDL applied on first access. Sent as a
 * single multi-statement query — atomic under the simple-query protocol and
 * safe for serverless poolers (no session-scoped advisory locks). Concurrent
 * cold starts resolve via Postgres' own IF NOT EXISTS semantics.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'stock',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_symbol_key ON watchlist (symbol);

CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  expiry TEXT NOT NULL,
  legs JSONB NOT NULL,
  thesis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'daily',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS briefs_day_kind_key ON briefs (day, kind);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  cards JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, created_at);
`;

let migrated: Promise<boolean> | null = null;

export function ensureTables(): Promise<boolean> {
  if (!pool) return Promise.resolve(false);
  if (!migrated) {
    migrated = (async () => {
      try {
        // retry once on cold-start races between concurrent lambdas
        try {
          await pool.query(DDL);
        } catch {
          await pool.query(DDL);
        }
        return true;
      } catch (err) {
        console.error("[db] self-migration failed:", err);
        migrated = null; // retry on next request
        return false;
      }
    })();
  }
  return migrated;
}
