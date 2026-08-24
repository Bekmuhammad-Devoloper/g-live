import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../../_components/ui";
import OperatorDetail, { type DCall, type DLead, type DMonth, type DOperator } from "./OperatorDetail";

// Operator profili — barcha ko'rsatkichlar real Lead + Call + User ma'lumotidan olinadi.
// Davr filtri: ?period=all|today|month|year yoki ?date=YYYY-MM-DD (aniq kun).

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtTime = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

type Period = "all" | "today" | "month" | "year";

export default async function OperatorDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; date?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireSession();
  const loc = s.locale as Locale;

  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(loc, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })}
      />
    );
  }
  const canManage = canWrite(s.role, MODULES.USERS);

  const now = new Date();
  const customDate = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const period: Period = customDate
    ? "all"
    : (["all", "today", "month", "year"] as const).includes(sp.period as Period) ? (sp.period as Period) : "all";

  let from: Date | null = null;
  let to: Date | null = null;
  if (customDate) {
    from = new Date(`${customDate}T00:00:00`);
    to = new Date(from.getTime() + 86_400_000);
  } else if (period === "today") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    to = new Date(from.getTime() + 86_400_000);
  } else if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (period === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear() + 1, 0, 1);
  }
  const range = from && to ? { gte: from, lt: to } : undefined;

  const [op, leads, calls, wonAll] = await Promise.all([
    // faol filial doirasida (boshqa filial operatori ochilmasin) — shu sabab findFirst
    prisma.user.findFirst({
      where: { AND: [{ id }, branchWhere(s)] },
      // XAVFSIZLIK: faqat kerakli maydonlar
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, isActive: true, imageUrl: true,
        sipExtension: true, position: true, fiksa: true, kpiBonus: true, plainPassword: true,
        lastLoginAt: true, createdAt: true, branch: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      // faol filial doirasida
      where: { AND: [{ managerId: id, ...(range ? { createdAt: range } : {}) }, branchWhere(s)] },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true, fullName: true, phone: true, stage: true, source: true, note: true,
        interestCourse: true, budget: true, createdAt: true, updatedAt: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, type: true, result: true, createdAt: true, author: { select: { fullName: true } } },
        },
      },
    }),
    prisma.call.findMany({
      where: { operatorId: id, ...(range ? { startedAt: range } : {}) },
      orderBy: { startedAt: "desc" },
      take: 300,
      select: {
        id: true, direction: true, status: true, leadId: true, contactName: true, phone: true,
        duration: true, recordingUrl: true, comment: true, startedAt: true,
      },
    }),
    // faol filial doirasida
    prisma.lead.findMany({ where: { AND: [{ managerId: id, stage: "WON" }, branchWhere(s)] }, select: { createdAt: true } }),
  ]);

  if (!op || op.role !== ROLES.OPERATOR) notFound();

  // Lid bo'yicha qo'ng'iroq statistikasi (davr ichida)
  const byLead = new Map<string, { calls: number; answered: number; sec: number }>();
  for (const c of calls) {
    if (!c.leadId) continue;
    const e = byLead.get(c.leadId) ?? { calls: 0, answered: 0, sec: 0 };
    e.calls++;
    if (c.status === "ANSWERED") { e.answered++; e.sec += c.duration; }
    byLead.set(c.leadId, e);
  }

  const dleads: DLead[] = leads.map((l) => {
    const st = byLead.get(l.id) ?? { calls: 0, answered: 0, sec: 0 };
    const hasCallActivity = l.activities.some((a) => a.type === "call");
    return {
      id: l.id,
      name: l.fullName,
      phone: l.phone,
      stage: l.stage,
      source: l.source,
      note: l.note,
      course: l.interestCourse,
      budget: l.budget,
      createdAt: fmtDate(l.createdAt),
      updatedAt: fmtDate(l.updatedAt),
      calls: st.calls,
      answered: st.answered,
      talkSec: st.sec,
      talked: st.answered > 0 || hasCallActivity,
      noAnswer: st.calls > 0 && st.answered === 0,
      activities: l.activities.map((a) => ({
        id: a.id,
        type: a.type,
        result: a.result,
        author: a.author?.fullName ?? null,
        date: `${fmtDate(a.createdAt)} ${fmtTime(a.createdAt)}`,
      })),
    };
  });

  const dcalls: DCall[] = calls.map((c) => ({
    id: c.id,
    direction: c.direction,
    status: c.status,
    leadId: c.leadId,
    contact: c.contactName,
    phone: c.phone,
    duration: c.duration,
    recordingUrl: c.recordingUrl,
    comment: c.comment,
    date: fmtDate(c.startedAt),
    time: fmtTime(c.startedAt),
  }));

  const total = dleads.length;
  const won = dleads.filter((l) => l.stage === "WON").length;
  const lost = dleads.filter((l) => l.stage === "LOST").length;
  const fresh = dleads.filter((l) => l.stage === "NEW").length;
  const missedCalls = dcalls.filter((c) => c.status === "MISSED" || c.status === "NO_ANSWER").length;
  const answered = dcalls.filter((c) => c.status === "ANSWERED");
  const talkSec = answered.reduce((n, c) => n + c.duration, 0);

  // Oylik maosh — fiksa + har muvaffaqiyatli lid uchun kpiBonus (reports/kpi bilan bir xil qoida)
  const months: DMonth[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cnt = wonAll.filter((w) => w.createdAt.getFullYear() === d.getFullYear() && w.createdAt.getMonth() === d.getMonth()).length;
    months.push({
      key: `${d.getFullYear()}-${p2(d.getMonth() + 1)}`,
      label: `${MONTHS[loc][d.getMonth()]} ${d.getFullYear()}`,
      won: cnt,
      bonus: op.kpiBonus,
      fiksa: op.fiksa,
      total: op.fiksa + cnt * op.kpiBonus,
      current: i === 0,
    });
  }

  const doperator: DOperator = {
    id: op.id,
    name: op.fullName,
    email: op.email,
    phone: op.phone,
    sip: op.sipExtension,
    avatar: op.imageUrl,
    position: op.position,
    branch: op.branch?.name ?? null,
    isActive: op.isActive,
    password: canManage ? op.plainPassword : null,
    fiksa: op.fiksa,
    kpiBonus: op.kpiBonus,
    createdAt: fmtDate(op.createdAt),
    lastLoginAt: op.lastLoginAt ? `${fmtDate(op.lastLoginAt)} ${fmtTime(op.lastLoginAt)}` : null,
  };

  return (
    <OperatorDetail
      locale={loc}
      op={doperator}
      leads={dleads}
      calls={dcalls}
      months={months}
      period={customDate ? "custom" : period}
      customDate={customDate}
      customDateLabel={customDate ? fmtDate(new Date(`${customDate}T00:00:00`)) : null}
      stats={{
        total, won, lost, fresh, missedCalls,
        conv: total > 0 ? Math.round((won / total) * 100) : 0,
        callsTotal: dcalls.length,
        answered: answered.length,
        talkSec,
      }}
    />
  );
}
