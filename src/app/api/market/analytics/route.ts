import { getBuildup, getMaxPainSeries, getPcrIntraday } from "@/lib/market/engine";
import { hasInstrument } from "@/lib/market/universe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "NIFTY";
  if (!hasInstrument(symbol)) return Response.json({ error: "unknown symbol" }, { status: 400 });
  return Response.json({
    symbol,
    pcrIntraday: getPcrIntraday(symbol),
    maxPainSeries: getMaxPainSeries(symbol),
    buildup: getBuildup(),
  });
}
