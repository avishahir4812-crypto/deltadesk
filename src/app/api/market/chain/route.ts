import { getChain } from "@/lib/market/engine";
import { hasInstrument } from "@/lib/market/universe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get("symbol") ?? "NIFTY";
  if (!hasInstrument(symbol)) return Response.json({ error: "unknown symbol" }, { status: 400 });
  const expiry = sp.get("expiry") ?? undefined;
  return Response.json(getChain(symbol, expiry));
}
