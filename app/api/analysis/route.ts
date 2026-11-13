import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/providers/analysis";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = normalize(new URL(req.url).searchParams.get("symbol") ?? "");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  try {
    return NextResponse.json(await getAnalysis(symbol));
  } catch (e) {
    console.warn("[analysis]", (e as Error).message);
    return NextResponse.json({ error: "Data source unavailable right now. Try again shortly." }, { status: 502 });
  }
}
