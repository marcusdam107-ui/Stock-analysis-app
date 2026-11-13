import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/providers/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (!q) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: await searchSymbols(q) });
}
