import { db, dbReady } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { strategies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const degraded = () => Response.json({ strategies: [], degraded: true });
const unavailable = () => Response.json({ error: "database unavailable" }, { status: 503 });

export async function GET() {
  if (!dbReady || !db) return degraded();
  try {
    await ensureSeeded();
    const rows = await db.select().from(strategies).orderBy(desc(strategies.createdAt)).limit(60);
    return Response.json({ strategies: rows });
  } catch (err) {
    console.error("[strategies:get]", err);
    return degraded();
  }
}

const legSchema = z.object({
  kind: z.enum(["CE", "PE", "FUT"]),
  side: z.enum(["BUY", "SELL"]),
  strike: z.number().nonnegative().optional(),
  lots: z.number().int().min(1).max(500),
  entry: z.number().nonnegative(),
});

const postSchema = z.object({
  name: z.string().min(2).max(80),
  symbol: z.string().min(2).max(24),
  expiry: z.string().min(4).max(12),
  legs: z.array(legSchema).min(1).max(12),
  thesis: z.string().max(600).optional(),
});

export async function POST(req: Request) {
  if (!dbReady || !db) return unavailable();
  try {
    await ensureSeeded();
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "invalid strategy" }, { status: 422 });
    }
    const [row] = await db
      .insert(strategies)
      .values({
        name: parsed.data.name,
        symbol: parsed.data.symbol.toUpperCase(),
        expiry: parsed.data.expiry,
        legs: parsed.data.legs,
        thesis: parsed.data.thesis ?? null,
      })
      .returning();
    return Response.json({ strategy: row }, { status: 201 });
  } catch (err) {
    console.error("[strategies:post]", err);
    return unavailable();
  }
}

export async function DELETE(req: Request) {
  if (!dbReady || !db) return unavailable();
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 422 });
    await db.delete(strategies).where(eq(strategies.id, id));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[strategies:delete]", err);
    return unavailable();
  }
}
