import { prisma } from "@/lib/db";
import { ROLES, formatMoney } from "@/lib/constants";
import { ensureSalaryPeriod, periodSummary } from "@/lib/finance/salary/periods";
import { yearMonthKey } from "@/lib/finance/period";
import { Forbidden, PageHeader } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import MonthPicker from "../MonthPicker";
import SalaryPeriodsView, { type PeriodRow, type AccountOpt } from "./SalaryPeriodsView";

// O'qituvchi maoshlari — oy bo'yicha davrlar (TEACHER faqat o'ziniki).
export default async function SalaryV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  const isTeacher = session.role === ROLES.TEACHER;
  if (!can("SALARY_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { ym, key } = monthFromSearch(await searchParams);
  const teachers = await prisma.user.findMany({
    where: isTeacher ? { id: session.userId } : { role: ROLES.TEACHER, isActive: true, ...(branchId ? { branchId } : {}) },
    select: { id: true, fullName: true }, orderBy: { fullName: "asc" },
  });
  const rows: PeriodRow[] = [];
  for (const t of teachers) {
    // Davr o'qish uchun ham yaratiladi (OPEN) — bu snapshot emas, faqat konteyner
    const period = flags.enabled ? await ensureSalaryPeriod(prisma, t.id, ym) : await prisma.salaryPeriod.findUnique({ where: { teacherId_year_month: { teacherId: t.id, year: ym.year, month: ym.month } } });
    const s = period ? await periodSummary(prisma, period.id) : null;
    rows.push({ periodId: period?.id ?? null, teacherId: t.id, teacherName: t.fullName, status: period?.status ?? "—", gross: s?.grossAmount ?? 0, commission: s?.commissionAmount ?? 0, fixed: s?.fixedAmount ?? 0, paid: s?.paidAmount ?? 0, remaining: s?.remainingAmount ?? 0, needsReview: s?.needsReviewCount ?? 0, source: period?.source ?? "V2" });
  }
  const accounts: AccountOpt[] = (await prisma.financialAccount.findMany({ where: { isActive: true, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } })).map((a) => ({ id: a.id, name: a.name }));
  const total = rows.reduce((a, r) => a + r.gross, 0);
  return (
    <>
      <PageHeader title={fin(L, "salary")} subtitle={`${yearMonthKey(ym)} · ${fin(L, "gross")}: ${formatMoney(total, L)}`} action={<MonthPicker value={key} />} />
      <SalaryPeriodsView locale={L} ym={key} rows={rows} accounts={accounts} perms={{ recalc: !isTeacher && flags.enabled, approve: can("SALARY_APPROVE") && flags.enabled, pay: can("SALARY_PAY") && flags.enabled, close: can("FINANCE_PERIOD_CLOSE") && flags.enabled, reopen: can("FINANCE_PERIOD_REOPEN") && flags.enabled }} />
    </>
  );
}
