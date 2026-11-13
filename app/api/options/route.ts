import { NextResponse } from "next/server";
import { getOptions } from "@/lib/providers/market";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbol = normalize(params.get("symbol") ?? "");
  const expiry = Number(params.get("expiry")) || undefined;
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  return NextResponse.json(await getOptions(symbol, expiry));
}
