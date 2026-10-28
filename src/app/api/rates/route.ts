import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRates } from "@/lib/rates";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getRates();
  if (!data) return NextResponse.json({ error: "unavailable", rates: [] }, { status: 503 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
