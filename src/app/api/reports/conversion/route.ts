import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { branchWhere } from "@/lib/branchScope";
import { ROLES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";
import { FUNNEL_STEPS, reached, type StepKey } from "@/app/(app)/reports/conversion/funnel";

type Counts = Record<StepKey | "yoqotilgan", number>;

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
  const manager = url.searchParams.get("manager") || "";

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59`);

  const branch = branchWhere(session);
  const where: Prisma.LeadWhereInput = {
    AND: [
      { ...(from || to ? { createdAt } : {}), ...(source ? { source } : {}) },
      branch,
    ],
  };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fullName: true, phone: true, stage: true, source: true, createdAt: true, managerId: true, studentId: true, archivedAt: true,
    },
  });

  const lastAuthor = new Map<string, string>();
  const noManager = leads.filter((l) => !l.managerId).map((l) => l.id);
  for (let i = 0; i < noManager.length; i += 500) {
    const rows = await prisma.leadActivity.findMany({
      where: { leadId: { in: noManager.slice(i, i + 500) }, authorId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { leadId: true, authorId: true },
    });
    for (const r of rows) if (r.authorId && !lastAuthor.has(r.leadId)) lastAuthor.set(r.leadId, r.authorId);
  }

  const withEmp = leads.map((l) => ({ ...l, employeeId: l.managerId ?? lastAuthor.get(l.id) ?? null }));

  const empIds = Array.from(new Set(withEmp.map((l) => l.employeeId).filter((x): x is string => !!x)));
  const users = empIds.length
    ? await prisma.user.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true, role: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const roleById = new Map(users.map((u) => [u.id, u.role]));

  const actWhere: Prisma.LeadActivityWhereInput = {
    authorId: { not: null },
    lead: branch,
    ...(from || to ? { createdAt } : {}),
  };
  const acts = await prisma.leadActivity.groupBy({ by: ["authorId"], where: actWhere, _count: { _all: true } });
  const actsById = new Map(acts.map((a) => [a.authorId as string, a._count._all]));

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
