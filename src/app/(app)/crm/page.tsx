import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../_components/ui";
import LeadsWorkspace from "./_components/LeadsWorkspace";
import { listKanbanGroups, listKanbanColumns } from "./actions";
import { columnOf, GROUP_COL_COLORS, type BranchColumn, type BranchMode, type VLead } from "./_lib/leadColumns";
import type { Analytics } from "./_components/AnalyticsTiles";

export default async function CrmPage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.CRM)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  // Filial rejimi (leadColumns.ts BranchMode):
  //   ROP va filial administratori — "sales": test/taklif o'rniga filial ustunlari;
  //   direktor / o'rinbosar — "head": hamma ustunlar + filial ustunlari ("Taklif" o'rnida).
  // ROP va rahbariyat barcha filiallar lidlarini ko'radi (ustunlar filial bo'yicha ajratadi),
  // administrator — faqat o'z filialini (o'z filiali ustuni).
  const branchMode: BranchMode | null =
    s.role === ROLES.ROP || s.role === ROLES.ADMIN ? "sales"
    : s.role === ROLES.DIRECTOR || s.role === ROLES.DEPUTY_DIRECTOR ? "head"
    : null;
  const allBranches = branchMode !== null && s.role !== ROLES.ADMIN;
  // Filial administratori onlayn lidlarni ko'rmaydi (ular ROP'niki) — faqat o'z filialiga
  // tashlangan ("br:<id>" belgili) onlayn lid ko'rinadi
  const isAdmin = s.role === ROLES.ADMIN;

  const [leads, managers, groupColumns, customColumns, branchRows] = await Promise.all([
    prisma.lead.findMany({
      where: allBranches
        ? {}
        : isAdmin
          ? { AND: [branchWhere(s), { OR: [{ studyFormat: { not: "ONLINE" } }, { studyFormat: null }, { kanbanColumnId: { startsWith: "br:" } }] }] }
          : branchWhere(s), // faol filial lidlarigina (filialsiz eski yozuvlar ham)
      orderBy: { createdAt: "desc" },
      // Faqat kerakli ustunlar — `include: { manager: true }` har lid uchun butun
      // User yozuvini (parol maydonlari bilan) tortib, 2000 lidda sahifani sekinlashtirardi
      select: {
        id: true, fullName: true, phone: true, email: true, telegram: true, studyFormat: true, source: true, stage: true,
        interestCourse: true, age: true, level: true, budget: true, note: true,
        managerId: true, studentId: true, groupId: true, enrollEditCount: true, kanbanColumnId: true, createdAt: true, branchId: true, branchSlotId: true,
        manager: { select: { fullName: true } },
        branch: { select: { name: true } },
        group: { select: { name: true } },
        _count: { select: { activities: true } },
      },
      take: 2000,
    }),
    prisma.user.findMany({ where: { role: ROLES.OPERATOR, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    listKanbanGroups(),   // Kanbanga biriktirilgan guruh ustunlari
    listKanbanColumns(),  // Oddiy nomli ustunlar
    branchMode
      ? prisma.branch.findMany({
          // Administrator — faqat o'z filiali ustuni
          where: { isActive: true, ...(s.role === ROLES.ADMIN && s.branchId ? { id: s.branchId } : {}) },
          select: { id: true, name: true, slots: { select: { id: true, branchId: true, room: true, days: true, startTime: true, endTime: true, note: true }, orderBy: [{ room: "asc" }, { startTime: "asc" }] } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const branchColumns: BranchColumn[] = branchRows.map((b, i) => ({
    branchId: b.id,
    name: b.name,
    color: GROUP_COL_COLORS[(i + 1) % GROUP_COL_COLORS.length],
    slots: b.slots,
  }));

  const vleads: VLead[] = leads.map((l) => ({
    id: l.id,
    fullName: l.fullName,
    phone: l.phone,
    email: l.email,
    telegram: l.telegram,
    studyFormat: l.studyFormat,
    source: l.source,
    stage: l.stage,
    interestCourse: l.interestCourse,
    age: l.age,
    level: l.level,
    budget: l.budget,
    note: l.note,
    managerId: l.managerId,
    managerName: l.manager?.fullName ?? null,
    studentId: l.studentId,
    branchId: l.branchId,
    branchName: l.branch?.name ?? null,
    branchSlotId: l.branchSlotId,
    groupId: l.groupId,
    groupName: l.group?.name ?? null,
    enrollEditCount: l.enrollEditCount,
    kanbanColumnId: l.kanbanColumnId,
    activityCount: l._count.activities,
    lastActivity: null,
    createdAt: l.createdAt.toISOString(),
  }));

  // Analitika
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const y0 = t0 - 86400000;
  const byColumn: Record<string, number> = {};
  for (const l of vleads) byColumn[columnOf(l.stage)] = (byColumn[columnOf(l.stage)] ?? 0) + 1;
  const won = vleads.filter((l) => ["PAID", "WON"].includes(l.stage)).length;
  const analytics: Analytics = {
    total: vleads.length,
    newToday: vleads.filter((l) => new Date(l.createdAt).getTime() >= t0).length,
    newYesterday: vleads.filter((l) => { const ts = new Date(l.createdAt).getTime(); return ts >= y0 && ts < t0; }).length,
    byColumn,
    conversion: vleads.length ? Math.round((won / vleads.length) * 100) : 0,
  };

  const sources = [...new Set(vleads.map((l) => l.source).filter((x): x is string => !!x))];

  return (
    <LeadsWorkspace
      locale={s.locale}
      initialLeads={vleads}
      managers={managers.map((m) => ({ id: m.id, name: m.fullName }))}
      sources={sources}
      analytics={analytics}
      canWrite={canWrite(s.role, MODULES.CRM)}
      // Kanbandan to'g'ridan-to'g'ri o'chirish — actions.ts dagi CAN_DELETE_LEAD bilan bir xil
      canDelete={[ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN].includes(s.role as never)}
      canResetColumns={[ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP].includes(s.role as never)}
      initialGroupColumns={groupColumns}
      initialCustomColumns={customColumns}
      branchColumns={branchMode ? branchColumns : null}
      branchMode={branchMode}
      showOnlineCol={!isAdmin}
      // Bo'sh vaqtlarni kim tahrirlaydi: rahbariyat — hammasini, administrator — o'z filialini
      slotsEditable={[ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(s.role as never) ? "all" : s.role === ROLES.ADMIN ? (s.branchId ?? null) : null}
    />
  );
}
