import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, canSeeTeamReports, getPermission, MODULES } from "@/lib/rbac";
import { ROLES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import KpiView from "./KpiView";
import type { Cat, VKpiRow } from "./KpiShared";

// Muvaffaqiyatli lid uchun standart bonus (so'm) — xodimda o'z kpiBonus qiymati bo'lmasa shu.
const BONUS = 200_000;
const DAY = 86_400_000;

// Eski loyiha rollari: operator → MANAGER, rop → DEPUTY_DIRECTOR, admin → ADMIN/DIRECTOR.
const CAT: Record<string, Cat> = {
  [ROLES.MANAGER]: "operator",
  [ROLES.DEPUTY_DIRECTOR]: "rop",
  [ROLES.DIRECTOR]: "admin",
  [ROLES.ADMIN]: "admin",
};

interface Agg {
  total: number;
  won: number;
  blocked: number;
  wonMonth: number;
}

export default async function KpiPage() {
  const s = await requireSession();
  const loc = s.locale as Locale;
  if (!canSeeTeamReports(s.role)) {
    return (
      <Forbidden
        title={tr(loc, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(loc, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })}
      />
    );
  }

  const roles = [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];
  const [users, leads] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        role: true,
        imageUrl: true, // avatar uchun (bo'lmasa ism bosh harflari)
        fiksa: true,
        kpiBonus: true,
        branchId: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.lead.findMany({
      where: { managerId: { not: null } },
      select: { managerId: true, stage: true, createdAt: true },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Har bir xodim bo'yicha lid statistikasi.
  const agg = new Map<string, Agg>();
  for (const u of users) agg.set(u.id, { total: 0, won: 0, blocked: 0, wonMonth: 0 });
  for (const l of leads) {
    const a = l.managerId ? agg.get(l.managerId) : undefined;
    if (!a) continue;
    a.total++;
    if (l.stage === "WON") {
      a.won++;
      if (l.createdAt >= monthStart) a.wonMonth++;
    } else if (l.stage === "LOST") {
      a.blocked++;
    }
  }

  // ROP qo'l ostidagi operatorlar — bizda bevosita bog'lanish yo'q,
  // shuning uchun bir filialdagi faol MANAGER'lar ROP'ning jamoasi hisoblanadi.
  const opsByBranch = new Map<string, string[]>();
  for (const u of users) {
    if (u.role !== ROLES.MANAGER || !u.branchId) continue;
    const list = opsByBranch.get(u.branchId);
    if (list) list.push(u.id);
    else opsByBranch.set(u.branchId, [u.id]);
  }

  const rows: VKpiRow[] = users.map((u) => {
    const cat = CAT[u.role] ?? "operator";

    // ROP ko'rsatkichi — jamoasidagi operatorlar yig'indisi (eski loyihadagidek).
    let a = agg.get(u.id) ?? { total: 0, won: 0, blocked: 0, wonMonth: 0 };
    let opsCount = 0;
    if (cat === "rop") {
      const team = (u.branchId && opsByBranch.get(u.branchId)) || [];
      opsCount = team.length;
      const sum: Agg = { total: 0, won: 0, blocked: 0, wonMonth: 0 };
      for (const id of team) {
        const x = agg.get(id);
        if (!x) continue;
        sum.total += x.total;
        sum.won += x.won;
        sum.blocked += x.blocked;
        sum.wonMonth += x.wonMonth;
      }
      a = sum;
    }

    // Konversiya (1 xonali kasr) va KPI% = min(100, konversiya × 2) — eski formulaning aynan o'zi.
    const conv = a.total > 0 ? Number(((a.won / a.total) * 100).toFixed(1)) : 0;
    const kpiPct = Math.min(100, Math.round(conv * 2));
    const bonus = u.kpiBonus ?? BONUS;
    // Ish kunlari: ishga qabul qilingandan oxirgi kirishgacha (yoki bugungacha).
    const end = u.lastLoginAt ?? now;
    const workDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - u.createdAt.getTime()) / DAY));

    return {
      id: u.id,
      name: u.fullName,
      cat,
      imageUrl: u.imageUrl,
      total: a.total,
      won: a.won,
      blocked: a.blocked,
      opsCount,
      conv,
      kpiPct,
      fiksa: u.fiksa,
      bonus,
      kpiMoney: a.won * bonus,
      wonMonth: a.wonMonth,
      earnedMonth: a.wonMonth * bonus,
      workDays,
    };
  });

  // Oylik/bonusni tahrirlash — faqat SALARY=FULL (Direktor / o'rinbosar / hisobchi).
  // "OWN" yetarli emas: o'qituvchi o'z oyligini ko'radi, lekin hech kimnikini tahrirlay olmaydi.
  const canEdit = getPermission(s.role, MODULES.SALARY) === "FULL";
  return <KpiView rows={rows} locale={loc} canEdit={canEdit} />;
}
