import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { normalizeExtension, webrtcConfigFor } from "@/lib/asterisk";
import { SIP_RANGE_LABEL } from "@/lib/sip";

const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

const hits = new Map<string, number[]>();
function limited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(userId, arr);
  return arr.length > 30;
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (limited(s.userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { sipExtension: true } });
  if (!u?.sipExtension) {
    return NextResponse.json({ error: "no_extension", message: tr(s.locale, { uz: "Sizga SIP extension biriktirilmagan", ru: "Вам не назначен SIP extension", en: "No SIP extension is assigned to you", de: "Ihnen ist keine SIP-Extension zugewiesen" }) }, { status: 400 });
  }
  if (!normalizeExtension(u.sipExtension)) {
    return NextResponse.json({ error: "bad_extension", message: tr(s.locale, { uz: `SIP raqami noto'g'ri: "${u.sipExtension}" (faqat ${SIP_RANGE_LABEL})`, ru: `Неверный SIP-номер: "${u.sipExtension}" (только ${SIP_RANGE_LABEL})`, en: `Invalid SIP extension: "${u.sipExtension}" (only ${SIP_RANGE_LABEL})`, de: `Ungültige SIP-Nummer: "${u.sipExtension}" (nur ${SIP_RANGE_LABEL})` }) }, { status: 400 });
  }
  const cfg = webrtcConfigFor(u.sipExtension);
  if (!cfg) {
    return NextResponse.json({ error: "no_password", message: tr(s.locale, { uz: `SIP parol topilmadi (${u.sipExtension})`, ru: `SIP-пароль не найден (${u.sipExtension})`, en: `SIP password not found (${u.sipExtension})`, de: `SIP-Passwort nicht gefunden (${u.sipExtension})` }) }, { status: 400 });
  }
  return NextResponse.json(cfg, { headers: { "Cache-Control": "no-store" } });
}
