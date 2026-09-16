// Finance V2 performance probe — sahifalar chaqiradigan dvigatel funksiyalari: vaqt (ms) va SQL so'rovlar soni.
// Prod hajmidagi NUSXADA ishlatiladi (backfill'dan keyin). Faqat o'qiydi.
//   npx tsx scripts/finance-v2/perf-probe.ts --db /abs/copy.db [--ym 2026-09]
import { PrismaClient } from "@prisma/client";
import { accountStatement, accountsOverview } from "@/lib/finance/accounts/balances";
import { paymentAvailability } from "@/lib/finance/billing/balance";
import { monthEnd, monthStart, parseYearMonthKey, tashkentYearMonth } from "@/lib/finance/period";
import { cashFlow, profitAndLoss } from "@/lib/finance/reports/cashflow";
import { collections, revenueBy } from "@/lib/finance/reports/collections";
import { financeDashboard } from "@/lib/finance/reports/dashboard";
import { debtReport, studentBalancesReport } from "@/lib/finance/reports/debt";
import { expensesBy } from "@/lib/finance/reports/expenses";
import { salaryPeriodsReport, teacherEarningsReport, unpaidSalaryReport } from "@/lib/finance/reports/salary";
import { periodEarningDetails, periodSummary } from "@/lib/finance/salary/periods";
import { fail, parseArgs, resolveDbPath } from "./_cli";

const SLOW_MS = 1500; // sahifa uchun sezilarli chegara
const MANY_QUERIES = 200; // N+1 shubhasi

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new PrismaClient({ datasourceUrl: `file:${resolveDbPath(args)}`, log: [{ emit: "event", level: "query" }] });
  let queries = 0;
  db.$on("query", () => { queries++; });
  const ym = typeof args.ym === "string" ? parseYearMonthKey(args.ym) : tashkentYearMonth(new Date());
  const range = { from: monthStart(ym), to: monthEnd(ym) };
  const rows: { name: string; ms: number; queries: number; size: number; flag: string }[] = [];
  const probe = async (name: string, fn: () => Promise<unknown>) => {
    queries = 0; const t = performance.now();
    const r = await fn();
    const ms = Math.round(performance.now() - t);
    const size = Array.isArray(r) ? r.length : r && typeof r === "object" && "rows" in (r as object) ? ((r as { rows: unknown[] }).rows?.length ?? 0) : 1;
    const flag = ms > SLOW_MS ? "SLOW" : queries > MANY_QUERIES ? "N+1?" : "ok";
    rows.push({ name, ms, queries, size, flag });
  };
  try {
    await probe("dashboard", () => financeDashboard(db, {}));
    await probe("debtors (debtReport)", () => debtReport(db, {}));
    await probe("student balances", () => studentBalancesReport(db, {}));
    await probe("payments list (month + availability)", async () => {
      const ps = await db.payment.findMany({ where: { legacyRole: null, postedAt: { not: null }, receivedAt: { gte: range.from, lt: range.to } }, orderBy: { receivedAt: "desc" }, include: { student: { select: { fullName: true } }, financialAccount: { select: { name: true } }, allocations: { select: { kind: true, amount: true } }, refunds: { select: { amount: true, status: true } } } });
      await paymentAvailability(db, ps.map((p) => p.id));
      return ps;
    });
    await probe("teacher salary list (periods + summary)", async () => {
      const periods = await db.salaryPeriod.findMany({ where: { year: ym.year, month: ym.month } });
      for (const p of periods) await periodSummary(db, p.id);
      return periods;
    });
    const biggest = await db.salaryPeriod.findFirst({ orderBy: { grossAmount: "desc" } });
    if (biggest) await probe("salary detail (biggest period)", async () => ({ rows: await periodEarningDetails(db, biggest.id) }));
    await probe("accounts overview", () => accountsOverview(db, {}));
    const acc = await db.financialAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (acc) await probe("account statement (month)", () => accountStatement(db, acc.id, range.from, range.to));
    await probe("report: collections by day", () => collections(db, range, "day"));
    await probe("report: collections by method", () => collections(db, range, "method"));
    await probe("report: revenue by teacher", () => revenueBy(db, range, "teacher"));
    await probe("report: expenses by category", () => expensesBy(db, range, "category"));
    await probe("report: teacher earnings", () => teacherEarningsReport(db, ym));
    await probe("report: salary periods", () => salaryPeriodsReport(db, { ym }));
    await probe("report: unpaid salary", () => unpaidSalaryReport(db));
    await probe("report: cash flow", () => cashFlow(db, range));
    await probe("report: P&L", () => profitAndLoss(db, ym));
    // Yillik oraliq — eng og'ir hisobot
    await probe("report: collections by month (12 oy)", () => collections(db, { from: monthStart({ year: ym.year - 1, month: ym.month }), to: monthEnd(ym) }, "month"));
    console.log(JSON.stringify({ ym, rows }, null, 2));
    const bad = rows.filter((r) => r.flag !== "ok");
    console.log(bad.length ? `⚠ ${bad.length} ta sekin/N+1 shubhali: ${bad.map((b) => b.name).join(", ")}` : "✓ perf: barcha probe'lar chegarada");
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
