import { NextResponse } from "next/server";
import { getTechnicals, TECH_TFS, type TechTf } from "@/lib/providers/analysis";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbol = normalize(params.get("symbol") ?? "");
  const tf = (params.get("tf") ?? "1D") as TechTf;
  if (!symbol || !(tf in TECH_TFS)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await getTechnicals(symbol, tf));
  } catch (e) {
    console.warn("[technicals]", (e as Error).message);
    return NextResponse.json({ error: "Data source unavailable right now. Try again shortly." }, { status: 502 });
  }
}
