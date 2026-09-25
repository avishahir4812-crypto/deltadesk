import { db, dbReady } from "@/db";
import { notes } from "@/db/schema";
import { ensureTables } from "@/db/migrate";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const unavailable = () => Response.json({ error: "database unavailable" }, { status: 503 });

const patchSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  body: z.string().max(20000).optional(),
  tags: z.array(z.string().min(1).max(24)).max(8).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!dbReady || !db) return unavailable();
  try {
    await ensureTables();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "invalid note" }, { status: 422 });
    const [row] = await db
      .update(notes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ note: row });
  } catch (err) {
    console.error("[notes:patch]", err);
    return unavailable();
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!dbReady || !db) return unavailable();
  try {
    await ensureTables();
    const { id } = await ctx.params;
    await db.delete(notes).where(eq(notes.id, id));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[notes:delete]", err);
    return unavailable();
  }
}
