// Finance V2 — SalaryPeriod (maosh davri) va to'lov (SalaryPayout), Phase 8.
//
// Manba — TeacherEarning (status=POSTED, settlementPeriodId). Davr ustunlari
// SNAPSHOT: `recalculateSalaryPeriod` ularni earning'lardan qayta yozadi (faqat
// OPEN/CALCULATED). Oqim: OPEN → CALCULATED → APPROVED → PARTIALLY_PAID → PAID → CLOSED.
// APPROVED+ davrga yangi earning tushmaydi (settlementPeriodFor keyingi ochiqni beradi).
// CLOSED immutable; reopen — FINANCE_PERIOD_REOPEN + sabab + audit.
// Payout — qo'lda (SALARY_PAY), kassa va summa majburiy, qisman, ledger OUT.
// 1-sanada avtomatik pul o'tkazish YO'Q — faqat eslatma ro'yxati.

import type { PrismaClient, SalaryPayout, SalaryPeriod, TeacherEarning } from "@prisma/client";
import { z } from "zod";

import { MAX_MONEY } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { SALARY_PERIOD_SETTLED_STATUSES, type SalaryPeriodStatus } from "../constants";
import { withFinanceTx, type FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertBranchAccess, requireFinancePermission } from "../permissions";
import { postLedger } from "../ledger/post";
import { assertPeriodOpen } from "../payments/periodLock";
import { nextMonth, tashkentYearMonth, yearMonthKey, type YearMonth } from "../period";
import { resolveRule } from "./rules";

export function isSettledStatus(status: string): boolean {
  return (SALARY_PERIOD_SETTLED_STATUSES as readonly string[]).includes(status as SalaryPeriodStatus);
}

/** (teacher, yil, oy) davri — bo'lmasa OPEN yaratiladi (idempotent) */
export async function ensureSalaryPeriod(db: FinanceDb, teacherId: string, ym: YearMonth): Promise<SalaryPeriod> {
  const existing = await db.salaryPeriod.findUnique({ where: { teacherId_year_month: { teacherId, year: ym.year, month: ym.month } } });
  if (existing) return existing;
  try {
    return await db.salaryPeriod.create({ data: { teacherId, year: ym.year, month: ym.month, status: "OPEN" } });
  } catch (e) {
    if (isUniqueViolation(e)) return db.salaryPeriod.findUniqueOrThrow({ where: { teacherId_year_month: { teacherId, year: ym.year, month: ym.month } } });
    throw e;
  }
}

/** Earning uchun settlement davri: o'z oyi ochiq bo'lsa o'zi, aks holda keyingi ochiq (yaratiladi) */
export async function settlementPeriodFor(db: FinanceDb, teacherId: string, earningMonth: YearMonth, maxHops = 36): Promise<SalaryPeriod> {
  let ym = earningMonth;
  for (let i = 0; i < maxHops; i++) {
    const period = await ensureSalaryPeriod(db, teacherId, ym);
    if (!isSettledStatus(period.status)) return period;
    ym = nextMonth(ym);
  }
  throw new FinanceError("state", "settlement davri topilmadi (36 oy ichida ochiq davr yo'q)");
}

export interface PeriodSummary {
  fixedAmount: number;
  commissionAmount: number;
  bonusAmount: number;
  kpiAmount: number;
  /** musbat kattalik (ushlanma) */
  penaltyAmount: number;
  /** ishorali: REFUND_ADJUSTMENT + MANUAL_ADJUSTMENT */
  adjustmentAmount: number;
  grossAmount: number;
  paidAmount: number;
  remainingAmount: number;
  earningsCount: number;
  needsReviewCount: number;
}

/** POSTED earning'lar (settlement = davr) va DONE payout'lardan yig'indi */
export async function periodSummary(db: FinanceDb, periodId: string): Promise<PeriodSummary> {
  const rows = await db.teacherEarning.groupBy({ by: ["type"], where: { settlementPeriodId: periodId, status: "POSTED" }, _sum: { amount: true }, _count: { _all: true } });
  const sum = (types: string[]) => rows.filter((r) => types.includes(r.type)).reduce((a, r) => a + (r._sum.amount ?? 0), 0);
  const fixedAmount = sum(["FIXED"]);
  const commissionAmount = sum(["PAYMENT_COMMISSION"]);
  const bonusAmount = sum(["BONUS"]);
  const kpiAmount = sum(["KPI"]);
  const penaltyAmount = -sum(["PENALTY"]);
  const adjustmentAmount = sum(["REFUND_ADJUSTMENT", "MANUAL_ADJUSTMENT"]);
  const grossAmount = fixedAmount + commissionAmount + bonusAmount + kpiAmount - penaltyAmount + adjustmentAmount;
  const paid = await db.salaryPayout.aggregate({ _sum: { amount: true }, where: { salaryPeriodId: periodId, status: "DONE" } });
  const paidAmount = paid._sum.amount ?? 0;
  const period = await db.salaryPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { teacherId: true } });
  // Faqat shu davrga (yoki undan oldingi oylarga) tushadigan ko'rib chiqilmagan earning'lar tasdiqni to'xtatadi — keyingi oylarniki emas
  const pr = await db.salaryPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { year: true, month: true } });
  const needsReviewCount = await db.teacherEarning.count({
    where: { teacherId: period.teacherId, status: "NEEDS_REVIEW", OR: [{ earningYear: { lt: pr.year } }, { earningYear: pr.year, earningMonth: { lte: pr.month } }] },
  });
  return {
    fixedAmount, commissionAmount, bonusAmount, kpiAmount, penaltyAmount, adjustmentAmount, grossAmount, paidAmount,
    remainingAmount: grossAmount - paidAmount, earningsCount: rows.reduce((a, r) => a + r._count._all, 0), needsReviewCount,
  };
}

/** O'qituvchining FIXED (oylik fiks) qoidasi bo'lsa — davr uchun bitta FIXED earning (idempotent) */
export async function ensureFixedEarning(db: FinanceDb, teacherId: string, ym: YearMonth, actorId?: string | null): Promise<TeacherEarning | null> {
  const idempotencyKey = `fixed:${teacherId}:${yearMonthKey(ym)}`;
  const existing = await db.teacherEarning.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  const teacher = await db.user.findUnique({ where: { id: teacherId }, select: { branchId: true } });
  const rule = await resolveRule(db, { serviceMonth: ym, teacherId, branchId: teacher?.branchId ?? null }, "FIXED");
  if (!rule || !rule.fixedAmount) return null;
  const period = await settlementPeriodFor(db, teacherId, ym);
  return db.teacherEarning.create({
    data: {
      teacherId, branchId: teacher?.branchId ?? null, ruleId: rule.id, serviceYear: ym.year, serviceMonth: ym.month, earningYear: ym.year, earningMonth: ym.month,
      settlementPeriodId: period.id, baseAmount: rule.fixedAmount, eligibleAmount: rule.fixedAmount, amount: rule.fixedAmount, type: "FIXED", status: "POSTED",
      snapshot: JSON.stringify({ fixed: true, rule: { id: rule.id, scope: rule.scope, fixedAmount: rule.fixedAmount, effectiveFrom: rule.effectiveFrom.toISOString() }, month: yearMonthKey(ym) }),
      idempotencyKey, createdById: actorId ?? null,
    },
  });
}

function assertNotSettled(period: SalaryPeriod): void {
  if (isSettledStatus(period.status)) throw new FinanceError("salary_period_locked", `Maosh davri ${period.status} — o'zgartirilmaydi (reopen kerak)`, { periodId: period.id, status: period.status });
}

async function writeSnapshot(db: FinanceDb, periodId: string, status?: string): Promise<SalaryPeriod> {
  const s = await periodSummary(db, periodId);
  return db.salaryPeriod.update({
    where: { id: periodId },
    data: {
      fixedAmount: s.fixedAmount, commissionAmount: s.commissionAmount, bonusAmount: s.bonusAmount, kpiAmount: s.kpiAmount, penaltyAmount: s.penaltyAmount,
      adjustmentAmount: s.adjustmentAmount, grossAmount: s.grossAmount, paidAmount: s.paidAmount, remainingAmount: s.remainingAmount, calculatedAt: new Date(),
      ...(status ? { status } : {}),
    },
  });
}

/** "Hisoblash": FIXED earning + snapshot ustunlari; earning yaratmaydi/o'chirmaydi; APPROVED+ ga tegmaydi */
export async function recalculateSalaryPeriod(db: FinanceDb, teacherId: string, ym: YearMonth, actor: { userId: string }): Promise<SalaryPeriod> {
  const period = await ensureSalaryPeriod(db, teacherId, ym);
  assertNotSettled(period);
  await ensureFixedEarning(db, teacherId, ym, actor.userId);
  const updated = await writeSnapshot(db, period.id, "CALCULATED");
  await financeAudit(db, { actorId: actor.userId, action: "CALCULATE", entityType: "SalaryPeriod", entityId: period.id, oldValue: { status: period.status, gross: period.grossAmount }, newValue: { status: "CALCULATED", gross: updated.grossAmount } });
  return updated;
}

export async function approveSalaryPeriod(db: FinanceDb, periodId: string, actor: Pick<SessionUser, "userId" | "role" | "branchId">, note?: string): Promise<SalaryPeriod> {
  requireFinancePermission(actor, "SALARY_APPROVE");
  const period = await db.salaryPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new FinanceError("not_found", "Davr topilmadi");
  assertNotSettled(period);
  await ensureFixedEarning(db, period.teacherId, { year: period.year, month: period.month }, actor.userId);
  const summary = await periodSummary(db, period.id);
  if (summary.needsReviewCount > 0) throw new FinanceError("state", `O'qituvchida ${summary.needsReviewCount} ta NEEDS_REVIEW earning bor — avval ko'rib chiqing`, { needsReview: summary.needsReviewCount });
  await writeSnapshot(db, period.id);
  const updated = await db.salaryPeriod.update({ where: { id: period.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: actor.userId, note: note ?? period.note } });
  await financeAudit(db, { actorId: actor.userId, action: "APPROVE", entityType: "SalaryPeriod", entityId: period.id, oldValue: { status: period.status }, newValue: { status: "APPROVED", gross: updated.grossAmount }, reason: note ?? null });
  return updated;
}

export const payoutSchema = z.object({
  salaryPeriodId: z.string().min(1),
  amount: z.number().int().positive().max(MAX_MONEY),
  financialAccountId: z.string().min(1),
  paidAt: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128),
});
export type PayoutInput = z.input<typeof payoutSchema>;

/** Qo'lda to'lov (qisman bo'lishi mumkin) — ledger OUT, davr snapshot yangilanadi */
export async function createPayoutTx(db: FinanceDb, raw: PayoutInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()): Promise<{ payout: SalaryPayout; period: SalaryPeriod; replayed: boolean }> {
  const input = payoutSchema.parse(raw);
  const replay = await db.salaryPayout.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) return { payout: replay, period: await db.salaryPeriod.findUniqueOrThrow({ where: { id: replay.salaryPeriodId } }), replayed: true };
  const period = await db.salaryPeriod.findUnique({ where: { id: input.salaryPeriodId } });
  if (!period) throw new FinanceError("not_found", "Davr topilmadi");
  if (period.status !== "APPROVED" && period.status !== "PARTIALLY_PAID") throw new FinanceError("state", `Faqat APPROVED/PARTIALLY_PAID davr to'lanadi (hozir ${period.status})`);
  if (input.paidAt.getTime() > now.getTime() + 60 * 60 * 1000) throw new FinanceError("validation", "To'lov sanasi kelajakda bo'lishi mumkin emas");
  const account = await db.financialAccount.findUnique({ where: { id: input.financialAccountId } });
  if (!account || !account.isActive) throw new FinanceError("validation", "Kassa topilmadi yoki faol emas");
  assertBranchAccess(actor, account.branchId);
  await assertPeriodOpen(db, account.branchId, tashkentYearMonth(input.paidAt)); // yopiq moliya oyiga payout yozilmaydi
  const summary = await periodSummary(db, period.id);
  if (input.amount > summary.remainingAmount) throw new FinanceError("insufficient", "Summa qoldiqdan katta", { remaining: summary.remainingAmount, requested: input.amount });
  const payout = await db.salaryPayout.create({
    data: { teacherId: period.teacherId, salaryPeriodId: period.id, financialAccountId: account.id, branchId: account.branchId, amount: input.amount, paidAt: input.paidAt, note: input.note ?? null, idempotencyKey: input.idempotencyKey, createdById: actor.userId },
  });
  await postLedger(db, { accountId: account.id, branchId: account.branchId, type: "SALARY_PAYOUT", direction: "OUT", amount: input.amount, referenceType: "SalaryPayout", referenceId: payout.id, occurredAt: input.paidAt, actorId: actor.userId, note: input.note ?? `Maosh ${yearMonthKey({ year: period.year, month: period.month })}` });
  const after = await periodSummary(db, period.id);
  const updated = await writeSnapshot(db, period.id, after.remainingAmount <= 0 ? "PAID" : "PARTIALLY_PAID");
  await financeAudit(db, { actorId: actor.userId, action: "PAYOUT", entityType: "SalaryPayout", entityId: payout.id, newValue: { periodId: period.id, amount: input.amount, accountId: account.id, paidAt: input.paidAt.toISOString(), remaining: after.remainingAmount }, reason: input.note ?? null });
  return { payout, period: updated, replayed: false };
}

export async function createPayout(client: PrismaClient, input: PayoutInput, actor: Pick<SessionUser, "userId" | "role" | "branchId">, now = new Date()) {
  requireFinancePermission(actor, "SALARY_PAY");
  return withFinanceTx(client, (tx) => createPayoutTx(tx, input, actor, now));
}

/** Yopish — faqat qoldiq 0 bo'lgan (PAID) davr; CLOSED immutable */
export async function closeSalaryPeriod(db: FinanceDb, periodId: string, actor: Pick<SessionUser, "userId" | "role" | "branchId">, reason: string): Promise<SalaryPeriod> {
  requireFinancePermission(actor, "FINANCE_PERIOD_CLOSE");
  if (reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const period = await db.salaryPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new FinanceError("not_found", "Davr topilmadi");
  if (period.status === "CLOSED") throw new FinanceError("state", "Davr allaqachon yopiq");
  let summary = await periodSummary(db, period.id);
  // Tasdiqlanmagan davr yopilmaydi (FIXED va boshqa earning'lar hisoblanmagan bo'lishi mumkin); gross 0 bo'lsa (hech narsa yo'q) — mumkin
  if (!["APPROVED", "PARTIALLY_PAID", "PAID"].includes(period.status) && summary.grossAmount !== 0) {
    throw new FinanceError("state", `Avval tasdiqlang (hozir ${period.status})`, { status: period.status });
  }
  if (summary.remainingAmount < 0) {
    // Manfiy qoldiq (masalan, to'langan davrdan keyingi qaytarim tuzatishi) — keyingi OCHIQ davrga o'tkaziladi:
    // bu davrda +X (carry-out), keyingi davrda −X (carry-in). Ikkalasi POSTED, idempotent, asl qatorlar o'zgarmaydi.
    const carry = -summary.remainingAmount;
    const next = await settlementPeriodFor(db, period.teacherId, nextMonth({ year: period.year, month: period.month }));
    const base = { teacherId: period.teacherId, type: "MANUAL_ADJUSTMENT", status: "POSTED", createdById: actor.userId } as const;
    for (const row of [
      { settlementPeriodId: period.id, amount: carry, earningYear: period.year, earningMonth: period.month, idempotencyKey: `carry-out:${period.id}`, note: "Manfiy qoldiq keyingi davrga o'tkazildi (carry-out)" },
      { settlementPeriodId: next.id, amount: -carry, earningYear: next.year, earningMonth: next.month, idempotencyKey: `carry-in:${period.id}`, note: `Oldingi davr (${yearMonthKey({ year: period.year, month: period.month })}) manfiy qoldig'i (carry-in)` },
    ]) {
      const exists = await db.teacherEarning.findUnique({ where: { idempotencyKey: row.idempotencyKey }, select: { id: true } });
      if (exists) continue;
      await db.teacherEarning.create({ data: { ...base, serviceYear: row.earningYear, serviceMonth: row.earningMonth, earningYear: row.earningYear, earningMonth: row.earningMonth, settlementPeriodId: row.settlementPeriodId, baseAmount: row.amount, eligibleAmount: row.amount, amount: row.amount, idempotencyKey: row.idempotencyKey, snapshot: JSON.stringify({ carryForward: true, fromPeriodId: period.id, toPeriodId: next.id, amount: carry, note: row.note }) } });
    }
    await financeAudit(db, { actorId: actor.userId, action: "CARRY_FORWARD", entityType: "SalaryPeriod", entityId: period.id, newValue: { amount: -carry, toPeriodId: next.id, toPeriod: yearMonthKey({ year: next.year, month: next.month }) }, reason });
    summary = await periodSummary(db, period.id);
  }
  if (summary.remainingAmount !== 0) throw new FinanceError("state", "Qoldiq 0 bo'lmagan davr yopilmaydi", { remaining: summary.remainingAmount });
  await writeSnapshot(db, period.id);
  const updated = await db.salaryPeriod.update({ where: { id: period.id }, data: { status: "CLOSED", closedAt: new Date(), closedById: actor.userId } });
  await financeAudit(db, { actorId: actor.userId, action: "CLOSE", entityType: "SalaryPeriod", entityId: period.id, oldValue: { status: period.status }, newValue: { status: "CLOSED", gross: updated.grossAmount, paid: updated.paidAmount }, reason });
  return updated;
}

/** Reopen — DIRECTOR (FINANCE_PERIOD_REOPEN), sabab majburiy, audit; davr CALCULATED holatiga qaytadi (to'lovlar saqlanadi) */
export async function reopenSalaryPeriod(db: FinanceDb, periodId: string, actor: Pick<SessionUser, "userId" | "role" | "branchId">, reason: string): Promise<SalaryPeriod> {
  requireFinancePermission(actor, "FINANCE_PERIOD_REOPEN");
  if (reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const period = await db.salaryPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new FinanceError("not_found", "Davr topilmadi");
  if (!isSettledStatus(period.status)) throw new FinanceError("state", "Davr yopiq/tasdiqlangan emas");
  const updated = await db.salaryPeriod.update({ where: { id: period.id }, data: { status: "CALCULATED", reopenedAt: new Date(), reopenedById: actor.userId, reopenReason: reason.trim() } });
  await financeAudit(db, { actorId: actor.userId, action: "REOPEN", entityType: "SalaryPeriod", entityId: period.id, oldValue: { status: period.status }, newValue: { status: "CALCULATED" }, reason });
  return updated;
}

export interface PayoutReminder {
  teacherId: string;
  periodId: string;
  period: string;
  remaining: number;
  status: string;
}

/** 1-sana eslatmasi uchun: tasdiqlangan, lekin to'liq to'lanmagan davrlar (pul o'tkazilmaydi) */
export async function payoutReminders(db: FinanceDb, ym: YearMonth): Promise<PayoutReminder[]> {
  const periods = await db.salaryPeriod.findMany({ where: { year: ym.year, month: ym.month, status: { in: ["APPROVED", "PARTIALLY_PAID"] } } });
  const out: PayoutReminder[] = [];
  for (const p of periods) {
    const s = await periodSummary(db, p.id);
    if (s.remainingAmount > 0) out.push({ teacherId: p.teacherId, periodId: p.id, period: yearMonthKey(ym), remaining: s.remainingAmount, status: p.status });
  }
  return out;
}

export interface EarningDetailRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  baseAmount: number;
  eligibleAmount: number;
  rateBp: number | null;
  studentName: string | null;
  paymentReceivedAt: Date | null;
  servicePeriod: string | null;
  earningMonth: string;
  allocatedAmount: number | null;
  groupName: string | null;
  programName: string | null;
  policyId: string | null;
  ruleId: string | null;
  reviewReason: string | null;
}

/** O'qituvchi oyligi tafsiloti (reja §15): o'quvchi, to'lov sanasi, xizmat oyi, taqsimot, baza, foiz, ulush, guruh, kurs, siyosat/qoida */
export async function periodEarningDetails(db: FinanceDb, periodId: string): Promise<EarningDetailRow[]> {
  const rows = await db.teacherEarning.findMany({
    where: { settlementPeriodId: periodId },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    include: { student: { select: { fullName: true } }, group: { select: { name: true } }, program: { select: { name: true } }, allocation: { select: { amount: true } } },
  });
  return rows.map((e) => ({
    id: e.id, type: e.type, status: e.status, amount: e.amount, baseAmount: e.baseAmount, eligibleAmount: e.eligibleAmount, rateBp: e.rateBp,
    studentName: e.student?.fullName ?? null, paymentReceivedAt: e.receivedAt, servicePeriod: e.serviceYear && e.serviceMonth ? yearMonthKey({ year: e.serviceYear, month: e.serviceMonth }) : null,
    earningMonth: yearMonthKey({ year: e.earningYear, month: e.earningMonth }), allocatedAmount: e.allocation?.amount ?? null,
    groupName: e.group?.name ?? null, programName: e.program?.name ?? null, policyId: e.policyId, ruleId: e.ruleId, reviewReason: e.reviewReason,
  }));
}
