import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, EDU_STATUSES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { computeDebts, monthlyFees } from "@/lib/debt";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import RevenueView, { type RevenueData } from "./RevenueView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ date?: string; status?: string }> }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim moliya bo'limi uchun.", ru: "Этот раздел для финансового отдела.", en: "This section is for the finance department.", de: "Dieser Bereich ist für die Finanzabteilung." })} />;
  }

  const sp = await searchParams;
  const today = new Date();
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? String(sp.date) : isoDay(today);
  const status = sp.status === undefined ? "ACTIVE" : (EDU_STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";

  const at = new Date(`${dateStr}T23:59:59`);
  const y = at.getFullYear(), m = at.getMonth();
  const monthStart = new Date(y, m, 1);
  const nextMonthStart = new Date(y, m + 1, 1);
  const prevMonthStart = new Date(y, m - 1, 1);
  const prevMonthEnd = new Date(y, m, 0, 23, 59, 59);

  const students = await prisma.student.findMany({
    where: { ...branchWhere(s), ...(status ? { eduStatus: status } : {}) },
    select: { id: true },
  });
  const ids = students.map((x) => x.id);
  const idSet = new Set(ids);

  const [fees, debtsPrev, debtsNow, paidRows, expenseAgg, expenseCount] = await Promise.all([
    monthlyFees(ids, monthStart),
    computeDebts(ids, prevMonthEnd),
    computeDebts(ids, at),
    prisma.payment.findMany({
      where: { AND: [{ status: "PAID" }, { createdAt: { gte: prevMonthStart, lt: nextMonthStart } }, branchViaStudent(s)] },
      select: { amount: true, studentId: true, createdAt: true, method: true },
    }),
    prisma.expense.aggregate({ where: { ...branchWhere(s), date: { gte: monthStart, lt: nextMonthStart } }, _sum: { amount: true } }),
    prisma.expense.count({ where: { ...branchWhere(s), date: { gte: monthStart, lt: nextMonthStart } } }),
  ]);

  const rel = status ? paidRows.filter((p) => idSet.has(p.studentId)) : paidRows;
  const thisM = rel.filter((p) => p.createdAt >= monthStart);
  const lastM = rel.filter((p) => p.createdAt < monthStart);
  const sum = (arr: { amount: number }[]) => arr.reduce((n, p) => n + p.amount, 0);
  const uniq = (arr: { studentId: string }[]) => new Set(arr.map((p) => p.studentId)).size;

  let expected = 0, expectedCount = 0;
  for (const v of fees.values()) if (v > 0) { expected += v; expectedCount++; }
  let carried = 0, carriedCount = 0;
  for (const v of debtsPrev.values()) if (v.debt > 0) { carried += v.debt; carriedCount++; }
  let remaining = 0, remainingCount = 0;
  for (const v of debtsNow.values()) if (v.debt > 0) { remaining += v.debt; remainingCount++; }

  const byMethod = new Map<string, number>();
  for (const p of thisM) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);

  const income = sum(thisM);
  const expenses = expenseAgg._sum.amount ?? 0;

  const data: RevenueData = {
    date: dateStr,
    status,
    students: ids.length,
    expected, expectedCount,
    carried, carriedCount,
    paidLast: sum(lastM), paidLastCount: uniq(lastM),
    paidThis: income, paidThisCount: uniq(thisM),
    remaining, remainingCount,
    expenses, expenseCount,
    byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([method, amount]) => ({ method, amount })),
    noPrices: ids.length > 0 && expected === 0,
  };

  return (
    <div>
      <LicenseBanner />
      <RevenueView data={data} locale={s.locale} />
    </div>
  );
}
