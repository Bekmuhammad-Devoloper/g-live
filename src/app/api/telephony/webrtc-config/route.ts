import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { webrtcConfigFor } from "@/lib/asterisk";

// Operator/ROP brauzer softphone'i uchun SIP ulanish konfiguratsiyasi.
// XAVFSIZLIK: sessiya majburiy, tez-tez so'rovlar cheklangan (parol qaytaradi).
const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

// Oddiy xotiradagi rate-limit (5/daqiqa har foydalanuvchi)
const hits = new Map<string, number[]>();
function limited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(userId, arr);
  return arr.length > 5;
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (limited(s.userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { sipExtension: true } });
  if (!u?.sipExtension) {
    return NextResponse.json({ error: "no_extension", message: "Sizga SIP extension biriktirilmagan" }, { status: 400 });
  }
  const cfg = webrtcConfigFor(u.sipExtension);
  if (!cfg) {
    return NextResponse.json({ error: "no_password", message: `SIP parol topilmadi (${u.sipExtension})` }, { status: 400 });
  }
  return NextResponse.json(cfg, { headers: { "Cache-Control": "no-store" } });
}
