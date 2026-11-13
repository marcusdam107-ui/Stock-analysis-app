import { NextResponse } from "next/server";
import { getFlow } from "@/lib/providers/flow";
import { normalize } from "@/lib/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = normalize(new URL(req.url).searchParams.get("symbol") ?? "");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  return NextResponse.json(await getFlow(symbol));
}
