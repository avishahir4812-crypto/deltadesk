import { db, dbReady } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { notes } from "@/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const degraded = () => Response.json({ notes: [], degraded: true });
const unavailable = () => Response.json({ error: "database unavailable" }, { status: 503 });

export async function GET() {
  if (!dbReady || !db) return degraded();
  try {
    await ensureSeeded();
    const rows = await db.select().from(notes).orderBy(desc(notes.pinned), desc(notes.updatedAt)).limit(200);
    return Response.json({ notes: rows });
  } catch (err) {
    console.error("[notes:get]", err);
    return degraded();
  }
}

const postSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().max(20000).default(""),
  tags: z.array(z.string().min(1).max(24)).max(8).default([]),
  pinned: z.boolean().default(false),
});

export async function POST(req: Request) {
  if (!dbReady || !db) return unavailable();
  try {
    await ensureSeeded();
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "invalid note" }, { status: 422 });
    const [row] = await db
      .insert(notes)
      .values({ title: parsed.data.title, body: parsed.data.body, tags: parsed.data.tags, pinned: parsed.data.pinned })
      .returning();
    return Response.json({ note: row }, { status: 201 });
  } catch (err) {
    console.error("[notes:post]", err);
    return unavailable();
  }
}
