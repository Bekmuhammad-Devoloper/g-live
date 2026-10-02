import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeTeamReports } from "@/lib/rbac";
import { canManageAdminTeam, canManageOperators, canSeeAdminTeam } from "@/lib/operatorAccess";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import OperatorsBoard, { type VOperator } from "./OperatorsBoard";
import { TEAM, type TeamKind } from "./teamKind";

// Jamoa monitoringi (operatorlar yoki filial administratorlari) — barcha ko'rsatkichlar
// real User + Lead + Call ma'lumotidan. Sana filtri (?date=YYYY-MM-DD) kunlik
// qo'ng'iroq ko'rsatkichlarini o'zgartiradi.
//
// Lid kimniki:
//   operator      — lidga biriktirilgan menejer (Lead.managerId);
//   administrator — menejer YOKI lid bilan ishlagan (faoliyat yozgan) administrator:
//                   administratorlarga lid biriktirilmaydi, ular filialga kelgan lidni
//                   bosqichdan bosqichga o'tkazadi va guruhga qabul qiladi.

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

export async function TeamBoardPage({ kind, searchParams }: { kind: TeamKind; searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const loc = s.locale as Locale;
  const cfg = TEAM[kind];
  const isAdminKind = kind === "admin";

  const allowed = isAdminKind ? canSeeAdminTeam(s.role) : canSeeTeamReports(s.role);
  if (!allowed) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(loc, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department.", de: "Dieser Bereich ist für die Vertriebsabteilung." })}
      />
    );
  }
  // Yaratish / tahrirlash / o'chirish tugmalari va parol ko'rinishi shunga bog'liq
  const canManage = isAdminKind ? canManageAdminTeam(s.role) : await canManageOperators(s.role, s.userId);

  // ROP filial almashtira olmaydi va lidlarni HAMMA filialga yo'naltiradi —
  // administratorlar bo'limida u barcha filial administratorlarini ko'radi.
  const scope = isAdminKind && s.role === ROLES.ROP ? {} : branchWhere(s);

  const now = new Date();
  const picked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const dayStart = picked ? new Date(`${picked}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const ops = await prisma.user.findMany({
    where: { AND: [{ role: cfg.role, isActive: true }, scope] },
    orderBy: { fullName: "asc" },
    // XAVFSIZLIK: select bilan faqat kerakli maydonlar (passwordHash hech qachon yuklanmaydi)
    select: {
      id: true, fullName: true, email: true, phone: true, imageUrl: true, sipExtension: true,
      fiksa: true, kpiBonus: true, plainPassword: true, lastLoginAt: true, createdAt: true,
      branchId: true, branch: { select: { name: true } },
    },
  });
  const ids = ops.map((o) => o.id);

  // Lidlar — har biri uchun "egalar" ro'yxati (yuqoridagi qoida bo'yicha)
  interface LeadRow { owners: string[]; stage: string; label: string }
  const loadLeads = async (): Promise<LeadRow[]> => {
    if (ids.length === 0) return [];
    if (isAdminKind) {
      const rows = await prisma.lead.findMany({
        where: { AND: [{ OR: [{ managerId: { in: ids } }, { activities: { some: { authorId: { in: ids } } } }] }, scope] },
        orderBy: { createdAt: "desc" },
        select: {
          managerId: true, stage: true, fullName: true, phone: true,
          activities: { where: { authorId: { in: ids } }, distinct: ["authorId"], select: { authorId: true } },
        },
      });
      return rows.map((l) => {
        const owners = new Set<string>();
        if (l.managerId) owners.add(l.managerId);
        for (const a of l.activities) if (a.authorId) owners.add(a.authorId);
        return { owners: [...owners], stage: l.stage, label: l.fullName || l.phone };
      });
    }
    const rows = await prisma.lead.findMany({
      where: { AND: [{ managerId: { in: ids } }, scope] },
      orderBy: { createdAt: "desc" },
      select: { managerId: true, stage: true, fullName: true, phone: true },
    });
    return rows.map((l) => ({ owners: l.managerId ? [l.managerId] : [], stage: l.stage, label: l.fullName || l.phone }));
  };

  const [leads, dayCalls, recentCalls, branches] = await Promise.all([
    loadLeads(),
    prisma.call.findMany({
      where: { operatorId: { in: ids }, startedAt: { gte: dayStart, lt: dayEnd } },
      select: { operatorId: true, duration: true },
    }),
    prisma.call.findMany({
      where: { operatorId: { in: ids } },
      orderBy: { startedAt: "desc" },
      take: 400,
      select: { operatorId: true, contactName: true, phone: true, startedAt: true, endedAt: true },
    }),
    // Administrator filialga biriktiriladi — yaratish/tahrirlash oynasidagi tanlov uchun
    isAdminKind && canManage
      ? prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  interface Agg { total: number; won: number; lost: number; calls: number; sec: number; lastLead: string | null; lastCall: string | null; onCall: boolean }
  const map = new Map<string, Agg>();
  for (const o of ops) map.set(o.id, { total: 0, won: 0, lost: 0, calls: 0, sec: 0, lastLead: null, lastCall: null, onCall: false });

  for (const l of leads) {
    for (const owner of l.owners) {
      const a = map.get(owner);
      if (!a) continue;
      a.total++;
      if (l.stage === "WON") a.won++;
      if (l.stage === "LOST") a.lost++;
      if (!a.lastLead) a.lastLead = l.label; // lidlar createdAt desc tartibida
    }
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
      branchId: o.branchId,
      branch: o.branch?.name ?? null,
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
      kind={kind}
      branches={branches}
      locale={loc}
      operators={operators}
      avgKpi={avgKpi}
      // takrorsiz lidlar (bitta lid bilan ikki administrator ishlagan bo'lsa ham bir marta)
      totalLeads={leads.length}
      dayCallsTotal={operators.reduce((n, o) => n + o.dayCalls, 0)}
      selectedDate={picked}
      selectedDateLabel={picked ? fmtDate(dayStart) : null}
      canManage={canManage}
    />
  );
}
