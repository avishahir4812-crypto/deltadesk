import { db, dbReady } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { briefs } from "@/db/schema";
import { buildBrief } from "@/lib/ai/brief";
import { latestTradingDayKey } from "@/lib/market/time";
import { desc, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Today's brief from Postgres (generated + persisted on first read). */
export async function GET() {
  const day = latestTradingDayKey();
  if (!dbReady || !db) {
    return Response.json({ brief: buildBrief(day), archive: [], degraded: true });
  }
  await ensureSeeded();
  try {
    let [row] = await db
      .select()
      .from(briefs)
      .where(and(eq(briefs.day, day), eq(briefs.kind, "daily")))
      .limit(1);
    if (!row) {
      await db.insert(briefs).values({ day, kind: "daily", payload: buildBrief(day) }).onConflictDoNothing();
      [row] = await db
        .select()
        .from(briefs)
        .where(and(eq(briefs.day, day), eq(briefs.kind, "daily")))
        .limit(1);
    }
    const archive = await db
      .select({ day: briefs.day, createdAt: briefs.createdAt })
      .from(briefs)
      .orderBy(desc(briefs.day))
      .limit(12);
    return Response.json({ brief: row?.payload ?? buildBrief(day), archive });
  } catch (err) {
    console.error("[brief] fallback:", err);
    return Response.json({ brief: buildBrief(day), archive: [], degraded: true });
  }
}
