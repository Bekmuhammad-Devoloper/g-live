import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { listSalaryRules } from "@/lib/finance/salary/rules";
import { salaryPolicyHistory, resolveSalaryPolicy, toSalaryPolicyView } from "@/lib/finance/salary/policy";
import { tashkentYearMonth, yearMonthKey } from "@/lib/finance/period";
import { Forbidden, PageHeader } from "../../../../_components/ui";
import { fin } from "../../_i18n";
import { financePage } from "../../_shared";
import SalarySettingsView, { type RuleRow, type PolicyRow, type Opt } from "./SalarySettingsView";

// Ish haqi sozlamalari (reja §16): umumiy sozlamalar (policy versiyalari), standart qoida (GLOBAL),
// maxsus qoidalar, davomat/holat qoidalari (policy ichida), tarix. Tayinlashlar — guruh sahifasi (Group.teacherId) + sync.
export default async function SalarySettingsPage() {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  if (!can("SALARY_RULE_MANAGE")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const [rules, policies, teachers, programs, groups, branches, current] = await Promise.all([
    listSalaryRules(prisma), salaryPolicyHistory(prisma),
    prisma.user.findMany({ where: { role: ROLES.TEACHER, isActive: true, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ where: branchId ? { branchId } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    resolveSalaryPolicy(prisma, branchId, tashkentYearMonth(new Date())),
  ]);
  const names = new Map<string, string>([...teachers, ...programs, ...groups, ...branches].map((x) => [x.id, ("fullName" in x ? x.fullName : x.name) as string]));
  const ruleRows: RuleRow[] = rules.map((r) => ({ id: r.id, scope: r.scope, target: r.targetId ? names.get(r.targetId) ?? r.targetId : "—", component: r.component, rateBp: r.rateBp, fixedAmount: r.fixedAmount, effectiveFrom: yearMonthKey(tashkentYearMonth(r.effectiveFrom)), effectiveTo: r.effectiveTo ? yearMonthKey(tashkentYearMonth(r.effectiveTo)) : null, legacy: r.legacy }));
  const policyRows: PolicyRow[] = policies.map((p) => ({ ...toSalaryPolicyView(p), id: p.id, effectiveFrom: yearMonthKey(tashkentYearMonth(p.effectiveFrom)), effectiveTo: p.effectiveTo ? yearMonthKey(tashkentYearMonth(p.effectiveTo)) : null }));
  const opts: Record<string, Opt[]> = { TEACHER: teachers.map((t) => ({ id: t.id, name: t.fullName })), COURSE: programs, GROUP: groups, BRANCH: branches, STUDENT: [], ASSIGNMENT: teachers.map((t) => ({ id: t.id, name: t.fullName })) };
  return (
    <>
      <PageHeader title={fin(L, "salarySettings")} subtitle={`${fin(L, "policy")}: ${current.name} v${current.version} · ${current.salaryBaseMode} · ${current.attendanceMode}`} />
      <SalarySettingsView locale={L} enabled={flags.enabled} rules={ruleRows} policies={policyRows} opts={opts} branches={branches} nextMonth={yearMonthKey(tashkentYearMonth(new Date()))} />
    </>
  );
}
