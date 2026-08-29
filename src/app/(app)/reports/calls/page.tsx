import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ROLES, type Locale } from "@/lib/constants";
import { canWrite, isScopedToOwn, MODULES } from "@/lib/rbac";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import CallsView from "./CallsView";
import type { CallStats, VCall, VOperator } from "./types";

const ALLOWED: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];
const ROW_LIMIT = 500;

// ── Sana/vaqt: Asia/Tashkent (UTC+5, yozgi vaqt yo'q) — deterministik,
//    toLocaleString ishlatilmaydi (SSR/CSR nomuvofiqligi bo'lmasin).
const TZ_MIN = 5 * 60;
const p2 = (n: number) => String(n).padStart(2, "0");
const tzOf = (d: Date) => new Date(d.getTime() + TZ_MIN * 60000);
const dayIdx = (d: Date) => Math.floor(tzOf(d).getTime() / 86400000);

function timeLabel(d: Date): string {
  const t = tzOf(d);
  return `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`;
}

function dayLabel(d: Date, today: number, locale: Locale): string {
  const diff = today - dayIdx(d);
  if (diff === 0) return tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" });
  if (diff === 1) return tr(locale, { uz: "Kecha", ru: "Вчера", en: "Yesterday", de: "Gestern" });
  const t = tzOf(d);
  return `${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}`;
}

function agoLabel(d: Date, nowMs: number, locale: Locale): string {
  const m = Math.max(0, Math.floor((nowMs - d.getTime()) / 60000));
  if (m < 1) return tr(locale, { uz: "hozirgina", ru: "только что", en: "just now", de: "gerade eben" });
  if (m < 60) return `${m} ${tr(locale, { uz: "daq oldin", ru: "мин назад", en: "min ago", de: "Min. her" })}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${tr(locale, { uz: "soat oldin", ru: "ч назад", en: "h ago", de: "Std. her" })}`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} ${tr(locale, { uz: "kun oldin", ru: "дн назад", en: "d ago", de: "Tg. her" })}`;
  return `${Math.floor(days / 7)} ${tr(locale, { uz: "hafta oldin", ru: "нед назад", en: "w ago", de: "Wo. her" })}`;
}

function fmtDur(sec: number): string {
  if (sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
}

const UNKNOWN = new Set(["<unknown>", "unknown", "anonymous", "unavailable", "s", ""]);
function isUnknownPhone(phone: string): boolean {
  return !phone || UNKNOWN.has(phone.trim().toLowerCase());
}

function fmtPhone(phone: string, locale: Locale): string {
  if (isUnknownPhone(phone)) return tr(locale, { uz: "Noma'lum raqam", ru: "Неизвестный номер", en: "Unknown number", de: "Unbekannte Nummer" });
  const c = phone.replace(/[^0-9]/g, "");
  if (c.length >= 9) {
    const n = c.slice(-9);
    return `+998 ${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5, 7)}-${n.slice(7)}`;
  }
  return phone;
}

// Audio yozuv manzili — faqat haqiqiy .wav fayllar (demo:// va boshqalar rad etiladi).
function recSrc(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/telephony/recordings/")) return url;
  const file = url.split("/").pop() ?? "";
  if (/^[\w.-]+\.wav$/.test(file)) return `/api/telephony/recordings/${encodeURIComponent(file)}`;
  return null;
}

// Qo'ng'iroqlar markazi — Call jadvalidan real ma'lumot (eski CRM tartibida).
export default async function CallsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim rahbariyat uchun.", ru: "Этот раздел для руководства.", en: "This section is for management.", de: "Dieser Bereich ist für die Geschäftsleitung." })}
      />
    );
  }
  const sp = (await searchParams) ?? {};
  const initialTab: "all" | "missed" = sp.tab === "missed" ? "missed" : "all";

  // Operator faqat O'Z qo'ng'iroqlarini ko'radi (REPORTS = "OWN").
  // ROP va rahbariyat butun jamoanikini ko'radi.
  const own = isScopedToOwn(s.role, MODULES.REPORTS);
  // Call'da branchId yo'q — qo'ng'iroqni qabul qilgan operator filiali bo'yicha
  // cheklaymiz (operatorsiz yozuvlar hamma filialda ko'rinadi)
  const branchScope: Prisma.CallWhereInput = s.branchId
    ? { OR: [{ operator: branchWhere(s) }, { operatorId: null }] }
    : {};
  const scope: Prisma.CallWhereInput = own
    ? { AND: [{ operatorId: s.userId }, branchScope] }
    : branchScope;

  const [calls, totalCount, byStatus, byDirection, answeredAgg, missedPending, operatorUsers] = await Promise.all([
    prisma.call.findMany({
      where: scope,
      orderBy: { startedAt: "desc" },
      take: ROW_LIMIT,
      select: {
        id: true, direction: true, status: true, operatorId: true, operatorName: true,
        leadId: true, contactName: true, phone: true, duration: true,
        recordingUrl: true, comment: true, callbackStatus: true, callbackAt: true, startedAt: true,
        lead: { select: { fullName: true, manager: { select: { fullName: true } } } },
      },
    }),
    prisma.call.count({ where: scope }),
    prisma.call.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.call.groupBy({ by: ["direction"], where: scope, _count: { _all: true } }),
    prisma.call.aggregate({ where: { ...scope, status: "ANSWERED" }, _avg: { duration: true } }),
    prisma.call.count({ where: { ...scope, status: "MISSED", callbackStatus: "PENDING" } }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const now = new Date();
  const nowMs = now.getTime();
  const today = dayIdx(now);

  const vcalls: VCall[] = calls.map((c) => {
    const contactName = c.contactName ?? c.lead?.fullName ?? null;
    return {
      id: c.id,
      direction: c.direction,
      status: c.status,
      operatorKey: c.operatorId ?? (c.operatorName ? `name:${c.operatorName}` : null),
      operatorName: c.operatorName,
      leadId: c.leadId,
      contactName,
      leadManagerName: c.lead?.manager?.fullName ?? null,
      phone: c.phone,
      phoneLabel: fmtPhone(c.phone, s.locale),
      phoneUnknown: isUnknownPhone(c.phone),
      duration: c.duration,
      durationLabel: fmtDur(c.duration),
      recordingSrc: recSrc(c.recordingUrl),
      comment: c.comment,
      callbackStatus: c.callbackStatus,
      dayLabel: dayLabel(c.startedAt, today, s.locale),
      timeLabel: timeLabel(c.startedAt),
      agoLabel: agoLabel(c.startedAt, nowMs, s.locale),
      callbackAtLabel: c.callbackAt ? `${dayLabel(c.callbackAt, today, s.locale)} ${timeLabel(c.callbackAt)}` : null,
      daysAgo: today - dayIdx(c.startedAt),
    };
  });

  const statusCount = (key: string) => byStatus.find((r) => r.status === key)?._count._all ?? 0;
  const dirCount = (key: string) => byDirection.find((r) => r.direction === key)?._count._all ?? 0;

  const stats: CallStats = {
    total: totalCount,
    answered: statusCount("ANSWERED"),
    missed: statusCount("MISSED"),
    incoming: dirCount("INCOMING"),
    outgoing: dirCount("OUTGOING"),
    avgDurationLabel: fmtDur(Math.round(answeredAgg._avg.duration ?? 0)),
    missedPending,
    loaded: vcalls.length,
  };

  // Operatorlar ro'yxati: faol xodimlar + qo'ng'iroqlardagi tarixiy nomlar (arxivlanganlar ham)
  const opMap = new Map<string, string>();
  for (const u of operatorUsers) opMap.set(u.id, u.fullName);
  for (const c of vcalls) {
    if (c.operatorKey && c.operatorName && !opMap.has(c.operatorKey)) opMap.set(c.operatorKey, c.operatorName);
  }
  const operators: VOperator[] = Array.from(opMap, ([key, name]) => ({ key, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <CallsView
      calls={vcalls}
      stats={stats}
      operators={operators}
      locale={s.locale}
      canMark={canWrite(s.role, MODULES.CRM)}
      initialTab={initialTab}
    />
  );
}
