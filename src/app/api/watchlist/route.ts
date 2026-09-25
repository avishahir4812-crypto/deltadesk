import { db, dbReady } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { watchlist } from "@/db/schema";
import { getQuotes } from "@/lib/market/engine";
import { hasInstrument, instrument } from "@/lib/market/universe";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const degraded = () => Response.json({ items: [], quotes: [], degraded: true });
const unavailable = () => Response.json({ error: "database unavailable" }, { status: 503 });

export async function GET() {
  if (!dbReady || !db) return degraded();
  try {
    await ensureSeeded();
    const rows = await db.select().from(watchlist).orderBy(asc(watchlist.sort));
    if (rows.length === 0) return Response.json({ items: [], quotes: [] });
    const quotes = getQuotes(rows.map((r) => r.symbol));
    return Response.json({ items: rows, quotes });
  } catch (err) {
    console.error("[watchlist:get]", err);
    return degraded();
  }
}

const postSchema = z.object({ symbol: z.string().min(2).max(24) });

export async function POST(req: Request) {
  if (!dbReady || !db) return unavailable();
  try {
    await ensureSeeded();
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success || !hasInstrument(parsed.data.symbol)) {
      return Response.json({ error: "invalid symbol" }, { status: 422 });
    }
    const inst = instrument(parsed.data.symbol);
    await db
      .insert(watchlist)
      .values({ symbol: inst.symbol, label: inst.name, kind: inst.kind, sort: 50 })
      .onConflictDoNothing();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[watchlist:post]", err);
    return unavailable();
  }
}

const delSchema = z.object({ symbol: z.string().min(2).max(24) });

export async function DELETE(req: Request) {
  if (!dbReady || !db) return unavailable();
  try {
    const body = await req.json().catch(() => null);
    const parsed = delSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 422 });
    await db.delete(watchlist).where(eq(watchlist.symbol, parsed.data.symbol.toUpperCase()));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[watchlist:delete]", err);
    return unavailable();
  }
}
