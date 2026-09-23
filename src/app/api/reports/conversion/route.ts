import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { branchWhere } from "@/lib/branchScope";
import { ROLES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";
import { FUNNEL_STEPS, reached, type StepKey } from "@/app/(app)/reports/conversion/funnel";

type Counts = Record<StepKey | "yoqotilgan", number>;

// Konversiya hisoboti — alohida API.
// UI (/reports/conversion) sana / manba / xodim filtrlarini shu yerga yuboradi.
//
// HISOB QOIDASI:
//   • So'rovlar — davrda YARATILGAN barcha lidlar (arxivlanganlar ham — ular real so'rov).
//   • Voronka YIG'MA: bosqichga "yetgan" = hozirgi bosqichi shu yoki undan keyingi
//     (Qabul qilingan lid hamma bosqichdan o'tgan). Yo'qotilgan alohida.
//   • Konversiya = Qabul qilinganlar (WON/PAID yoki o'quvchi yozuvi bor) / So'rovlar × 100.
//   • Xodim: lidga biriktirilgan menejer; bo'lmasa — lid bilan oxirgi ishlagan xodim
//     (oxirgi faoliyat muallifi); hech kim bo'lmasa — "Biriktirilmagan".

// Sahifadagi ALLOWED bilan bir xil — administrator kiritilmagan
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP, ROLES.MANAGER];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(session.role as never)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const source = url.searchParams.get("source") || "";
  const manager = url.searchParams.get("manager") || ""; // xodim id yoki "none" (biriktirilmagan)

  // Sana oralig'i (kun) → DateTime filtri
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59`);

  // Barcha so'rovlar faol filial doirasida
  const branch = branchWhere(session);
  const where: Prisma.LeadWhereInput = {
    AND: [
      { ...(from || to ? { createdAt } : {}), ...(source ? { source } : {}) },
      branch,
    ],
  };

  // Davr va manba bo'yicha lidlar + oxirgi faoliyat muallifi (xodim aniqlash uchun)
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fullName: true, phone: true, stage: true, source: true, createdAt: true, managerId: true, studentId: true, archivedAt: true,
      activities: { where: { authorId: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, select: { authorId: true } },
    },
  });

  // Xodim: menejer → oxirgi faoliyat muallifi → null
  const withEmp = leads.map((l) => ({ ...l, employeeId: l.managerId ?? l.activities[0]?.authorId ?? null }));

  // Xodim nomlari (davrdagi hamma xodimlar — filtr variantlari ham shundan)
  const empIds = Array.from(new Set(withEmp.map((l) => l.employeeId).filter((x): x is string => !!x)));
  const users = empIds.length
    ? await prisma.user.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true, role: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const roleById = new Map(users.map((u) => [u.id, u.role]));

  // Davrdagi faoliyatlar soni — xodim bo'yicha (qo'ng'iroq, xabar, eslatma ...)
  const actWhere: Prisma.LeadActivityWhereInput = {
    authorId: { not: null },
    lead: branch,
    ...(from || to ? { createdAt } : {}),
  };
  const acts = await prisma.leadActivity.groupBy({ by: ["authorId"], where: actWhere, _count: { _all: true } });
  const actsById = new Map(acts.map((a) => [a.authorId as string, a._count._all]));

  // Xodim filtri (natijaviy ro'yxat va voronka uchun)
  const filtered = manager ? withEmp.filter((l) => (manager === "none" ? !l.employeeId : l.employeeId === manager)) : withEmp;

  const stepCounts = (rows: typeof filtered): Counts => {
    const c = {} as Counts;
    for (const s of FUNNEL_STEPS) c[s.key] = rows.filter((l) => reached(l, s.key)).length;
    c.yoqotilgan = rows.filter((l) => l.stage === "LOST").length;
    return c;
  };
  const counts = stepCounts(filtered);
  const total = filtered.length;
  const conversion = total ? Math.round((counts.qabul / total) * 1000) / 10 : 0;

  // Har xodim bo'yicha alohida (xodim filtridan qat'i nazar — jadval to'liq ko'rinadi)
  const byEmp = new Map<string, typeof withEmp>();
  for (const l of withEmp) {
    const k = l.employeeId ?? "none";
    (byEmp.get(k) ?? byEmp.set(k, []).get(k)!).push(l);
  }
  const employees = Array.from(byEmp.entries()).map(([id, rows]) => {
    const c = stepCounts(rows);
    return {
      id,
      name: id === "none" ? null : nameById.get(id) ?? "—",
      role: id === "none" ? null : roleById.get(id) ?? null,
      total: rows.length,
      ...c,
      activities: id === "none" ? 0 : actsById.get(id) ?? 0,
      conversion: rows.length ? Math.round((c.qabul / rows.length) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.qabul - a.qabul || b.total - a.total);

  // Dropdown variantlari — sana filtrisiz (filial doirasida)
  const allLeads = await prisma.lead.findMany({ where: branch, select: { source: true } });
  const sources = Array.from(new Set(allLeads.map((l) => l.source).filter((x): x is string => !!x))).sort();
  const managers = users.map((u) => ({ id: u.id, name: u.fullName })).sort((a, b) => a.name.localeCompare(b.name));

  const rows = filtered.map((l) => ({
    id: l.id,
    fullName: l.fullName,
    phone: l.phone,
    stage: l.stage,
    source: l.source,
    createdAt: l.createdAt.toISOString(),
    studentId: l.studentId,
    archived: !!l.archivedAt,
    employeeId: l.employeeId,
    employeeName: l.employeeId ? nameById.get(l.employeeId) ?? null : null,
  }));

  return NextResponse.json({
    total,
    counts,
    conversion,
    employees,
    leads: rows,
    options: { sources, managers, hasUnassigned: withEmp.some((l) => !l.employeeId) },
  });
}
