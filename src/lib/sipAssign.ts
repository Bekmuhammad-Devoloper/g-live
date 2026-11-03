import "server-only";
import { prisma } from "./db";
import { tr } from "./tr";
import { writeAudit } from "./audit";
import { ROLES, type Locale } from "./constants";
import { DEFAULT_SIP_COUNT, canonicalSipExtension, sipRangeLabel, type SipOption } from "./sip";

export type SipClaim = { sip: string | null } | { error: string };

export function configuredSipExtensions(): string[] {
  const nums = Object.keys(process.env)
    .map((k) => /^SIP_OPERATOR(\d+)_PASS$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m && !!process.env[m[0]])
    .map((m) => Number(m[1]))
    .filter((n) => n >= 1);
  const list = nums.length ? nums : Array.from({ length: DEFAULT_SIP_COUNT }, (_, i) => i + 1);
  return [...new Set(list)].sort((a, b) => a - b).map((n) => `glive${n}`);
}

const CAN_RELEASE: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
export const canReleaseSip = (role: string): boolean => CAN_RELEASE.includes(role);

async function holdersOf(ext: string, exceptUserId: string | null) {
  const users = await prisma.user.findMany({
    where: { sipExtension: { not: null }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true, fullName: true, isActive: true, sipExtension: true },
  });
  return users.filter((u) => canonicalSipExtension(u.sipExtension) === ext);
}

export async function claimSipExtension(
  locale: Locale,
  userId: string | null,
  raw: string,
  actor: { userId: string; role: string },
  current: string | null = null,
): Promise<SipClaim> {
  const input = raw.trim();
  if (!input) return { sip: null };
  if (current && (input === current || (canonicalSipExtension(input) ?? input) === canonicalSipExtension(current))) return { sip: current };

  const allowed = configuredSipExtensions();
  const sip = canonicalSipExtension(input);
  if (!sip || !allowed.includes(sip)) {
    const range = sipRangeLabel(allowed);
    return { error: tr(locale, { uz: `SIP raqami ${range} dan biri bo'lishi kerak`, ru: `SIP-номер должен быть одним из ${range}`, en: `SIP extension must be one of ${range}`, de: `SIP-Nummer muss eine von ${range} sein` }) };
  }

  const holders = await holdersOf(sip, userId);
  const active = holders.find((h) => h.isActive);
  if (active) {
    return { error: tr(locale, { uz: `${sip} band: ${active.fullName}`, ru: `${sip} занят: ${active.fullName}`, en: `${sip} is taken: ${active.fullName}`, de: `${sip} ist belegt: ${active.fullName}` }) };
  }
  if (holders.length && !canReleaseSip(actor.role)) {
    const name = holders[0].fullName;
    return { error: tr(locale, { uz: `${sip} arxivdagi xodimda (${name}) — uni direktor yoki administrator bo'shatishi kerak`, ru: `${sip} у сотрудника в архиве (${name}) — освободить может директор или администратор`, en: `${sip} belongs to an archived staff member (${name}) — a director or administrator must free it`, de: `${sip} gehört einem archivierten Mitarbeiter (${name}) — nur Direktor oder Administrator kann sie freigeben` }) };
  }
  for (const h of holders) {
    await prisma.user.update({ where: { id: h.id }, data: { sipExtension: null } });
    await writeAudit({ actorId: actor.userId, action: "UPDATE", entityType: "User", entityId: h.id, oldValue: { sipExtension: h.sipExtension }, newValue: { sipExtension: null }, reason: "SIP raqami ishdan ketgan xodimdan bo'shatildi" });
  }
  return { sip };
}

export async function listSipOptions(): Promise<SipOption[]> {
  const holders = await prisma.user.findMany({
    where: { sipExtension: { not: null } },
    select: { sipExtension: true, fullName: true, isActive: true },
  });
  return configuredSipExtensions().map((ext) => {
    const own = holders.filter((h) => canonicalSipExtension(h.sipExtension) === ext);
    const h = own.find((x) => x.isActive) ?? own[0];
    return { ext, owner: h?.fullName ?? null, ownerActive: h?.isActive ?? false };
  });
}
