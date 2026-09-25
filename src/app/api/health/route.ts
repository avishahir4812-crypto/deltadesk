import { db, dbReady } from "@/db";
import { ensureTables } from "@/db/migrate";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbReady || !db) {
    return Response.json({ ok: true, db: "not-configured", engine: "ready" });
  }
  try {
    await ensureTables();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "connected", engine: "ready" });
  } catch {
    return Response.json({ ok: false, db: "error" }, { status: 500 });
  }
}
