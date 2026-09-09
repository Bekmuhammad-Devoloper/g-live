import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { amiOriginate, amiConfigured, normalizeUzPhone } from "@/lib/asterisk";
import { writeAudit } from "@/lib/audit";

// Click-to-call — AMI Originate (avval operatorni jiringlatadi, keyin mijozni teradi).
const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!amiConfigured()) return NextResponse.json({ error: "ami_off", message: tr(s.locale, { uz: "Telefoniya sozlanmagan (.env)", ru: "Телефония не настроена (.env)", en: "Telephony is not configured (.env)", de: "Telefonie ist nicht konfiguriert (.env)" }) }, { status: 503 });

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { sipExtension: true, fullName: true } });
  if (!u?.sipExtension) return NextResponse.json({ error: "no_extension", message: tr(s.locale, { uz: "Sizga SIP extension biriktirilmagan", ru: "Вам не назначен SIP extension", en: "No SIP extension is assigned to you", de: "Ihnen ist keine SIP-Extension zugewiesen" }) }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { number?: string; leadId?: string; contactName?: string };
  const number = normalizeUzPhone(String(body.number ?? ""));
  if (number.length < 9) return NextResponse.json({ error: "bad_number" }, { status: 400 });

  // Qo'ng'iroq yozuvi (worker keyin holat/davomiylikni yangilaydi)
  const call = await prisma.call.create({
    data: {
      direction: "OUTGOING",
      status: "NO_ANSWER",
      operatorId: s.userId,
      operatorName: u.fullName,
      leadId: body.leadId || null,
      contactName: body.contactName || null,
      phone: number,
      callbackStatus: "NONE",
    },
  });

  const r = await amiOriginate({ extension: u.sipExtension, number, callerId: u.fullName, callRecordId: call.id });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Call", entityId: call.id, newValue: { number, ok: r.ok } });

  if (!r.ok) {
    await prisma.call.update({ where: { id: call.id }, data: { status: "FAILED", comment: r.message || null } });
    // Sababni foydalanuvchiga tushunarli qilib aytamiz
    const raw = r.message || "";
    const message =
      /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|timeout/i.test(raw)
        ? tr(s.locale, { uz: "Telefoniya tunneli yopiq. Terminalda: npm run tunnel", ru: "Туннель телефонии закрыт. В терминале: npm run tunnel", en: "Telephony tunnel is down. In the terminal: npm run tunnel", de: "Telefonie-Tunnel ist geschlossen. Im Terminal: npm run tunnel" })
        : /Originate failed/i.test(raw)
          ? tr(s.locale, { uz: "Operator javob bermadi (mikrofonga ruxsat bering va sahifani yangilang)", ru: "Оператор не ответил (разрешите доступ к микрофону и обновите страницу)", en: "Operator did not answer (allow microphone access and reload the page)", de: "Operator hat nicht geantwortet (Mikrofonzugriff erlauben und Seite neu laden)" })
          : raw || tr(s.locale, { uz: "Qo'ng'iroq amalga oshmadi", ru: "Звонок не удался", en: "Call failed", de: "Anruf fehlgeschlagen" });
    return NextResponse.json({ ok: false, error: raw || "originate_failed", message, callId: call.id }, { status: 502 });
  }
  return NextResponse.json({ ok: true, callId: call.id });
}
