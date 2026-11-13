import { NextResponse } from "next/server";
import { CANDLES, getCandles, TIMEFRAMES, type CandleSize, type Timeframe } from "@/lib/providers/market";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbol = normalize(params.get("symbol") ?? "");
  const tf = (params.get("tf") ?? "1D") as Timeframe;
  const size = (params.get("candle") || undefined) as CandleSize | undefined;
  if (!symbol || !(tf in TIMEFRAMES) || (size && !(size in CANDLES))) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json(await getCandles(symbol, tf, size));
}
