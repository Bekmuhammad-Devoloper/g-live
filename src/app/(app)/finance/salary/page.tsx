import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, getPermission, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import SalaryCalculatorView, { type VRule } from "./SalaryCalculatorView";

const p2 = (n: number) => String(n).padStart(2, "0");

// "Ish haqi" — maosh kalkulyatori sozlamalari (qoidalar + hisoblash).
export default async function SalaryCalculatorPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.SALARY)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section." })} />;
  }

  const [rules, teachers, programs, groups, students] = await Promise.all([
    prisma.salaryRule.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    prisma.user.findMany({ where: { role: ROLES.TEACHER, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  const vrules: VRule[] = rules.map((r) => ({
    id: r.id,
    scope: r.scope,
    amountType: r.amountType,
    amount: r.amount,
    isDefault: r.isDefault,
    targetName: r.targetName,
  }));

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
        canManage={canManage}
        locale={s.locale}
        period={period}
      />
    </div>
  );
}
