import { db, dbReady } from "@/db";
import { ensureTables } from "@/db/migrate";
import { chatMessages } from "@/db/schema";
import { answer } from "@/lib/ai/engine";
import { asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session") ?? "default";
  if (!dbReady || !db) return Response.json({ messages: [] });
  await ensureTables();
  try {
    const rows = await db
      .select()
      .from(chatMessages)
      .orderBy(asc(chatMessages.createdAt))
      .limit(400);
    return Response.json({ messages: rows.filter((r) => r.sessionId === sessionId).slice(-60) });
  } catch {
    return Response.json({ messages: [] });
  }
}

const postSchema = z.object({
  message: z.string().min(1).max(800),
  sessionId: z.string().min(1).max(64).default("default"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "invalid message" }, { status: 422 });

    const { message, sessionId } = parsed.data;
    const out = answer(message);

    if (dbReady && db) {
      try {
        await ensureTables();
        await db.insert(chatMessages).values([
          { sessionId, role: "user", content: message },
          { sessionId, role: "assistant", content: out.reply, cards: out.cards },
        ]);
      } catch (err) {
        console.error("[chat] persistence skipped:", err);
      }
    }
    return Response.json(out);
  } catch (err) {
    console.error("[chat:post]", err);
    return Response.json(
      { reply: "The copilot hit an unexpected error. Please try again.", cards: [] },
      { status: 200 }
    );
  }
}
