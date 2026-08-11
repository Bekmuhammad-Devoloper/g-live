import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  if (!amiConfigured()) return NextResponse.json({ error: "ami_off", message: "Telefoniya sozlanmagan (.env)" }, { status: 503 });

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { sipExtension: true, fullName: true } });
  if (!u?.sipExtension) return NextResponse.json({ error: "no_extension", message: "Sizga SIP extension biriktirilmagan" }, { status: 400 });

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
        ? "Telefoniya tunneli yopiq. Terminalda: npm run tunnel"
        : /Originate failed/i.test(raw)
          ? "Operator javob bermadi (mikrofonga ruxsat bering va sahifani yangilang)"
          : raw || "Qo'ng'iroq amalga oshmadi";
    return NextResponse.json({ ok: false, error: raw || "originate_failed", message, callId: call.id }, { status: 502 });
  }
  return NextResponse.json({ ok: true, callId: call.id });
}
