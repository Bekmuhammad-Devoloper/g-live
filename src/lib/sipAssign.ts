import "server-only";
import { prisma } from "./db";
import { tr } from "./tr";
import { writeAudit } from "./audit";
import type { Locale } from "./constants";
import { SIP_EXTENSIONS, SIP_RANGE_LABEL, parseSipExtension, type SipOption } from "./sip";

export type SipClaim = { sip: string | null } | { error: string };

async function holdersOf(ext: string, exceptUserId: string | null) {
  const users = await prisma.user.findMany({
    where: { sipExtension: { not: null }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true, fullName: true, isActive: true, sipExtension: true },
  });
  return users.filter((u) => parseSipExtension(u.sipExtension) === ext);
}

export async function claimSipExtension(locale: Locale, userId: string | null, raw: string, actorId: string): Promise<SipClaim> {
  if (!raw.trim()) return { sip: null };
  const sip = parseSipExtension(raw);
  if (!sip) {
    return { error: tr(locale, { uz: `SIP raqami ${SIP_RANGE_LABEL} dan biri bo'lishi kerak`, ru: `SIP-номер должен быть одним из ${SIP_RANGE_LABEL}`, en: `SIP extension must be one of ${SIP_RANGE_LABEL}`, de: `SIP-Nummer muss eine von ${SIP_RANGE_LABEL} sein` }) };
  }

  const holders = await holdersOf(sip, userId);
  const active = holders.find((h) => h.isActive);
  if (active) {
    return { error: tr(locale, { uz: `${sip} band: ${active.fullName}`, ru: `${sip} занят: ${active.fullName}`, en: `${sip} is taken: ${active.fullName}`, de: `${sip} ist belegt: ${active.fullName}` }) };
  }
  for (const h of holders) {
    await prisma.user.update({ where: { id: h.id }, data: { sipExtension: null } });
    await writeAudit({ actorId, action: "UPDATE", entityType: "User", entityId: h.id, oldValue: { sipExtension: h.sipExtension }, newValue: { sipExtension: null }, reason: "SIP raqami ishdan ketgan xodimdan bo'shatildi" });
  }
  return { sip };
}

export async function listSipOptions(): Promise<SipOption[]> {
  const holders = await prisma.user.findMany({
    where: { sipExtension: { not: null } },
    select: { sipExtension: true, fullName: true, isActive: true },
  });
  return SIP_EXTENSIONS.map((ext) => {
    const own = holders.filter((h) => parseSipExtension(h.sipExtension) === ext);
    const h = own.find((x) => x.isActive) ?? own[0];
    return { ext, owner: h?.fullName ?? null, ownerActive: h?.isActive ?? false };
  });
}
