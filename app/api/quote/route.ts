import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/providers/market";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "")
    .split(",").map(normalize).filter(Boolean).slice(0, 20);
  if (!symbols.length) return NextResponse.json({ error: "symbols required" }, { status: 400 });
  return NextResponse.json(await getQuotes(symbols));
}
