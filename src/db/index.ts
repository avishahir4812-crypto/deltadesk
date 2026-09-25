import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Deployment-proof connection layer:
 *  - Accepts DATABASE_URL, POSTGRES_URL or POSTGRES_URL_NON_POOLING so a plain
 *    Vercel Postgres / Neon integration works with zero renaming.
 *  - Builds and runs the app fine with NO database configured (degraded mode).
 *  - Auto-enables SSL for non-local hosts (Neon, Supabase, RDS, Vercel).
 */
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

const LOCAL_HOST = /(localhost|127\.0\.0\.1|\[::1\])/i;
const needsSsl = !!databaseUrl && !LOCAL_HOST.test(databaseUrl) && !/sslmode=disable/i.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __terminalPool?: Pool;
};

function createPool(): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool: Pool | null = databaseUrl ? globalForDb.__terminalPool ?? createPool() : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__terminalPool = pool;
}

// Never crash the process on a stray pooled-connection error (idle client cut
// by a serverless pooler, network blip, ...). Queries surface their own errors.
if (pool) {
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
}

export const db: NodePgDatabase | null = pool ? drizzle(pool) : null;

export const dbReady = pool !== null;
