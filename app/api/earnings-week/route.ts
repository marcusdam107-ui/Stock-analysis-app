import { NextResponse } from "next/server";
import { getEarningsWeek } from "@/lib/providers/earnings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getEarningsWeek());
}
