import { NextResponse } from "next/server";
import { getTrumpFeed } from "@/lib/providers/trump";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTrumpFeed());
}
