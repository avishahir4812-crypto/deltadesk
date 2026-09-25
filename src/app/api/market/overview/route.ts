import { getOverview } from "@/lib/market/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getOverview());
}
