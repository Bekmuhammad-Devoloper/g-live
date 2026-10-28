import { NextResponse } from "next/server";
import { getBuildId } from "@/lib/buildId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ build: getBuildId() }, { headers: { "Cache-Control": "no-store" } });
}
