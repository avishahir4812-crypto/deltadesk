import { db, dbReady } from "@/db";
import { ensureTables } from "@/db/migrate";
import { briefs } from "@/db/schema";
import { buildBrief } from "@/lib/ai/brief";
import { latestTradingDayKey } from "@/lib/market/time";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target (see vercel.json) — the N8N-style scheduled job that
 * assembles the daily desk brief. In this demo build the same brief is also
 * materialised lazily by /api/ai/brief, so the route is idempotent and fully
 * tolerant of the database being absent.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const day = latestTradingDayKey();
  const brief = buildBrief(day);
  let persisted = false;
  if (dbReady && db) {
    try {
      if (await ensureTables()) {
        await db.insert(briefs).values({ day, kind: "daily", payload: brief }).onConflictDoNothing();
        persisted = true;
      }
    } catch (err) {
      console.error("[cron/brief] persistence skipped:", err);
    }
  }
  return Response.json({ ok: true, day, persisted });
}
