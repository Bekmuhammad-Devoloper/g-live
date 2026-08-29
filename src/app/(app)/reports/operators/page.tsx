import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canSeeTeamReports, MODULES } from "@/lib/rbac";
import { canManageOperators } from "@/lib/operatorAccess";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import OperatorsBoard, { type VOperator } from "./OperatorsBoard";

// Operatorlar monitoringi — barcha ko'rsatkichlar real User + Lead + Call ma'lumotidan.
// Sana filtri (?date=YYYY-MM-DD) kunlik qo'ng'iroq ko'rsatkichlarini o'zgartiradi.

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtTime = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

function ago(d: Date | null, locale: Locale): string {
  if (!d) return tr(locale, { uz: "hech qachon", ru: "никогда", en: "never", de: "nie" });
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return tr(locale, { uz: "hozir", ru: "сейчас", en: "now", de: "gerade eben" });
  if (min < 60) return tr(locale, { uz: `${min} daq oldin`, ru: `${min} мин назад`, en: `${min} min ago`, de: `vor ${min} Min.` });
  const h = Math.floor(min / 60);
  if (h < 24) return tr(locale, { uz: `${h} soat oldin`, ru: `${h} ч назад`, en: `${h} h ago`, de: `vor ${h} Std.` });
  const days = Math.floor(h / 24);
  return tr(locale, { uz: `${days} kun oldin`, ru: `${days} дн назад`, en: `${days} days ago`, de: `vor ${days} Tagen` });
}

const ONLINE_MS = 15 * 60 * 1000; // oxirgi 15 daqiqada kirgan bo'lsa — online
const ON_CALL_MS = 2 * 60 * 60 * 1000; // tugamagan (endedAt=null) va 2 soatdan yangi qo'ng'iroq — liniyada

export default async function OperatorsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const loc = s.locale as Locale;

  if (!canSeeTeamReports(s.role)) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(loc, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Vertriebsabteilung." })}
      />
    );
  }
  // Direktor/Administrator yoki ROP — "Yangi operator" va tahrirlash tugmalari shunga bog'liq
  const canManage = await canManageOperators(s.role, s.userId);

  const now = new Date();
  const picked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const dayStart = picked ? new Date(`${picked}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [ops, leads, dayCalls, recentCalls] = await Promise.all([
    prisma.user.findMany({
      where: { AND: [{ role: ROLES.OPERATOR, isActive: true }, branchWhere(s)] }, // faol filial doirasida
      orderBy: { fullName: "asc" },
      // XAVFSIZLIK: select bilan faqat kerakli maydonlar (passwordHash hech qachon yuklanmaydi)
      select: {
        id: true, fullName: true, email: true, phone: true, imageUrl: true, sipExtension: true,
        fiksa: true, kpiBonus: true, plainPassword: true, lastLoginAt: true, createdAt: true,
      },
    }),
    prisma.lead.findMany({
      where: { AND: [{ managerId: { not: null } }, branchWhere(s)] }, // faol filial doirasida
      orderBy: { createdAt: "desc" },
      select: { managerId: true, stage: true, fullName: true, phone: true },
    }),
    prisma.call.findMany({
      // faol filial operatorlarining qo'ng'iroqlari
      where: { AND: [{ operatorId: { not: null }, startedAt: { gte: dayStart, lt: dayEnd } }, { operator: branchWhere(s) }] },
      select: { operatorId: true, duration: true },
    }),
    prisma.call.findMany({
      where: { AND: [{ operatorId: { not: null } }, { operator: branchWhere(s) }] }, // faol filial doirasida
      orderBy: { startedAt: "desc" },
      take: 400,
      select: { operatorId: true, contactName: true, phone: true, startedAt: true, endedAt: true },
    }),
  ]);

  interface Agg { total: number; won: number; lost: number; calls: number; sec: number; lastLead: string | null; lastCall: string | null; onCall: boolean }
  const map = new Map<string, Agg>();
  for (const o of ops) map.set(o.id, { total: 0, won: 0, lost: 0, calls: 0, sec: 0, lastLead: null, lastCall: null, onCall: false });

  for (const l of leads) {
    const a = l.managerId ? map.get(l.managerId) : null;
    if (!a) continue;
    a.total++;
    if (l.stage === "WON") a.won++;
    if (l.stage === "LOST") a.lost++;
    if (!a.lastLead) a.lastLead = l.fullName || l.phone; // leads createdAt desc tartibida
  }
  for (const c of dayCalls) {
    const a = c.operatorId ? map.get(c.operatorId) : null;
    if (!a) continue;
    a.calls++;
    a.sec += c.duration;
  }
  for (const c of recentCalls) {
    const a = c.operatorId ? map.get(c.operatorId) : null;
    if (!a || a.lastCall) continue; // calls startedAt desc — birinchisi oxirgi qo'ng'iroq
    a.lastCall = `${c.contactName || c.phone} • ${fmtTime(c.startedAt)}`;
    a.onCall = c.endedAt === null && now.getTime() - c.startedAt.getTime() < ON_CALL_MS;
  }

  const operators: VOperator[] = ops.map((o) => {
    const a = map.get(o.id)!;
    return {
      id: o.id,
      name: o.fullName,
      email: o.email,
      phone: o.phone,
      sip: o.sipExtension,
      avatar: o.imageUrl,
      password: canManage ? o.plainPassword : null,
      fiksa: o.fiksa,
      kpiBonus: o.kpiBonus,
      dayCalls: a.calls,
      dayTalkSec: a.sec,
      total: a.total,
      won: a.won,
      lost: a.lost,
      conv: a.total > 0 ? Math.round((a.won / a.total) * 100) : 0,
      online: !!o.lastLoginAt && now.getTime() - o.lastLoginAt.getTime() < ONLINE_MS,
      onCall: a.onCall,
      lastOnline: ago(o.lastLoginAt, loc),
      lastLead: a.lastLead,
      lastCall: a.lastCall,
      createdAt: fmtDate(o.createdAt),
    };
  });

  const avgKpi = operators.length ? Math.round(operators.reduce((n, o) => n + o.conv, 0) / operators.length) : 0;

  return (
    <OperatorsBoard
      locale={loc}
      operators={operators}
      avgKpi={avgKpi}
      totalLeads={operators.reduce((n, o) => n + o.total, 0)}
      dayCallsTotal={operators.reduce((n, o) => n + o.dayCalls, 0)}
      selectedDate={picked}
      selectedDateLabel={picked ? fmtDate(dayStart) : null}
      canManage={canManage}
    />
  );
}
