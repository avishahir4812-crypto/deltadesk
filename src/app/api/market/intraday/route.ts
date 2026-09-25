import { getCandles, getSpot } from "@/lib/market/engine";
import { SESSION_MINUTES, liveMinute } from "@/lib/market/time";
import { hasInstrument } from "@/lib/market/universe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "NIFTY";
  if (!hasInstrument(symbol)) return Response.json({ error: "unknown symbol" }, { status: 400 });
  const all = getCandles(symbol);
  const upto = Math.min(Math.floor(liveMinute() / 5), all.length - 1);
  return Response.json({ symbol, candles: all.slice(0, upto + 1), spot: getSpot(symbol), session: SESSION_MINUTES });
}
