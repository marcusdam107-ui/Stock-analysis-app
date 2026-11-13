import { NextResponse } from "next/server";
import { getContract } from "@/lib/providers/market";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbol = normalize(params.get("symbol") ?? "");
  const expiry = Number(params.get("expiry"));
  const strike = Number(params.get("strike"));
  const cp = params.get("cp") === "P" ? "P" : "C";
  if (!symbol || !expiry || !strike) return NextResponse.json({ error: "symbol, expiry and strike required" }, { status: 400 });
  return NextResponse.json(await getContract(symbol, expiry, strike, cp));
}
