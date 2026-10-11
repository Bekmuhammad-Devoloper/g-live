import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere, staffBranchWhere } from "@/lib/branchScope";
import { getSalarySettings, normalizeSalaryType } from "@/lib/salaryCalc";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import SalaryCalculatorView, { type VRule } from "./SalaryCalculatorView";

const p2 = (n: number) => String(n).padStart(2, "0");

// "Ish haqi" — maosh kalkulyatori (qoidalar, sozlamalar, hisoblash va profilga chiqarish).
export default async function SalaryCalculatorPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.SALARY)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [rules, teachers, programs, groups, students, enrollments, settings] = await Promise.all([
    // SalaryRule va Program — umumiy ma'lumotnoma (filialga bog'liq emas)
    prisma.salaryRule.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    prisma.user.findMany({ where: { AND: [{ role: ROLES.TEACHER, isActive: true }, staffBranchWhere(s)] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ where: branchWhere(s), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: branchWhere(s), select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.groupStudent.findMany({ where: { student: branchWhere(s) }, select: { studentId: true, groupId: true } }),
    getSalarySettings(),
  ]);

  // Qoida jadvali uchun nomlar: yaratgan/yangilagan xodim, guruh kursi va o'qituvchisi
  const userIds = [...new Set(rules.flatMap((r) => [r.createdById, r.updatedById]).filter((x): x is string => !!x))];
  const ruleGroupIds = [...new Set(rules.flatMap((r) => [r.scope === "GROUP" ? r.targetId : null, r.groupId]).filter((x): x is string => !!x))];
  const [users, ruleGroups] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    ruleGroupIds.length
      ? prisma.group.findMany({ where: { id: { in: ruleGroupIds } }, select: { id: true, program: { select: { name: true } }, teacher: { select: { fullName: true } } } })
      : Promise.resolve([]),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.fullName]));
  const gInfo = new Map(ruleGroups.map((g) => [g.id, g]));

  const vrules: VRule[] = rules.map((r) => {
    const gid = r.scope === "GROUP" ? r.targetId : r.groupId;
    const gi = gid ? gInfo.get(gid) : undefined;
    return {
      id: r.id,
      scope: r.isDefault ? "ALL" : r.scope,
      amountType: normalizeSalaryType(r.amountType),
      amount: r.amount,
      isDefault: r.isDefault || r.scope === "ALL",
      targetId: r.targetId,
      targetName: r.targetName,
      groupId: r.groupId,
      groupName: r.groupName,
      courseName: r.scope === "COURSE" ? r.targetName : gi?.program.name ?? null,
      groupLabel: r.scope === "GROUP" ? r.targetName : r.groupName,
      teacherName: r.scope === "TEACHER" ? r.targetName : gi?.teacher?.fullName ?? null,
      studentName: r.scope === "STUDENT" ? r.targetName : null,
      createdBy: r.createdById ? userName.get(r.createdById) ?? null : null,
      createdAt: r.createdAt.toISOString(),
      updatedBy: r.updatedById ? userName.get(r.updatedById) ?? null : null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    };
  });

  const now = new Date();
  const period = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
  const canManage = getPermission(s.role, MODULES.SALARY) === "FULL";

  return (
    <div>
      <LicenseBanner />
      <SalaryCalculatorView
        rules={vrules}
        teachers={teachers}
        programs={programs}
        groups={groups}
        students={students}
        enrollments={enrollments.map((e) => [e.studentId, e.groupId] as [string, string])}
        settings={settings}
        canManage={canManage}
        locale={s.locale}
        period={period}
      />
    </div>
  );
}
