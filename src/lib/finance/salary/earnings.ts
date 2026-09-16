// Finance V2 — TeacherEarning dvigateli (Phase 6, ENG MUHIM).
//
// Har PaymentAllocation (kind=ALLOCATION) × xizmat oyidagi tayinlash → bitta
// PAYMENT_COMMISSION earning (idempotencyKey + @@unique(allocationId, assignmentId, type)).
//
// Sanalar (FINAL):
//   teacher/rate  — SERVICE PERIOD bo'yicha (tarixiy assignment va qoida)
//   earningMonth  — MANBA TO'LOV `Payment.receivedAt` oyi (allocatedAt EMAS; avansda ham)
//   settlement    — o'z oyi ochiq bo'lsa o'zi, aks holda keyingi ochiq davr
//
// NEEDS_REVIEW (total/payout/ledger'ga kirmaydi, admin POSTED qiladi):
//   NO_LESSONS_FOUND · ASSISTANT_NO_RULE · RATE_SUM_EXCEEDED · AMBIGUOUS_ASSIGNMENT (bir oyda 2+ MAIN)
//   · LEGACY_INFERRED (cutover'dan oldingi INFERRED tayinlash)

import type { GroupTeacherAssignment, PaymentAllocation, TeacherEarning } from "@prisma/client";

import type { EarningReviewReason } from "../constants";
import type { FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { applyRateBp } from "../money";
import { cutoverAtFrom } from "../cutover";
import { monthStart, tashkentYearMonth, yearMonthKey, type YearMonth } from "../period";
import { assignmentsForService } from "./assignments";
import { computeEligibility } from "./eligibility";
import { settlementPeriodFor } from "./periods";
import { resolveSalaryPolicy } from "./policy";
import { resolveRule, type RuleView } from "./rules";

export interface EarningContext {
  actorId?: string | null;
  /** Berilmasa `Setting finance.v2.cutoverAt` (tranzaksiya orqali) */
  cutoverAt?: Date;
}

export interface EarningOutcome {
  created: TeacherEarning[];
  /** allaqachon mavjud (idempotent) */
  existing: number;
  /** o'qituvchisiz/guruhsiz allocation'lar */
  skipped: { allocationId: string; reason: string }[];
}

interface AssignmentPlan {
  assignment: GroupTeacherAssignment;
  rule: RuleView | null;
  reviewReason: EarningReviewReason | null;
}

async function planAssignments(db: FinanceDb, charge: { groupId: string; programId: string | null; branchId: string | null; studentId: string }, serviceMonth: YearMonth): Promise<AssignmentPlan[]> {
  const assignments = await assignmentsForService(db, charge.groupId, serviceMonth);
  const mains = assignments.filter((a) => a.role === "MAIN");
  const plans: AssignmentPlan[] = [];
  for (const a of assignments) {
    const rule = a.role === "MAIN"
      ? await resolveRule(db, { serviceMonth, studentId: charge.studentId, teacherId: a.teacherId, groupId: charge.groupId, programId: charge.programId, branchId: charge.branchId, assignmentRuleId: a.compensationRuleId }, "PERCENT")
      : await resolveRule(db, { serviceMonth, teacherId: a.teacherId, assignmentRuleId: a.compensationRuleId }, "PERCENT", ["ASSIGNMENT", "TEACHER"]);
    let reviewReason: EarningReviewReason | null = null;
    if (a.source === "INFERRED") reviewReason = "LEGACY_INFERRED";
    else if (a.role === "ASSISTANT" && !rule) reviewReason = "ASSISTANT_NO_RULE";
    else if (a.role === "MAIN" && mains.length > 1) reviewReason = "AMBIGUOUS_ASSIGNMENT";
    plans.push({ assignment: a, rule, reviewReason });
  }
  const totalBp = plans.reduce((s, p) => s + (p.rule?.rateBp ?? 0), 0);
  if (totalBp > 10_000) for (const p of plans) p.reviewReason = p.reviewReason ?? "RATE_SUM_EXCEEDED";
  return plans;
}

/** Allocation'lar uchun earning yaratadi (tranzaksiya ichida chaqiriladi) */
export async function createEarningsForAllocations(db: FinanceDb, allocations: PaymentAllocation[], ctx: EarningContext = {}): Promise<EarningOutcome> {
  const out: EarningOutcome = { created: [], existing: 0, skipped: [] };
  if (allocations.length === 0) return out;
  const cutoverAt = ctx.cutoverAt ?? (await cutoverAtFrom(db));
  for (const alloc of allocations) {
    if (alloc.kind !== "ALLOCATION") continue;
    const charge = await db.studentCharge.findUnique({ where: { id: alloc.chargeId } });
    const payment = await db.payment.findUnique({ where: { id: alloc.paymentId }, select: { id: true, receivedAt: true, method: true, financialAccountId: true, branchId: true } });
    if (!charge || !payment) throw new FinanceError("not_found", "Allocation manbasi topilmadi", { allocationId: alloc.id });
    if (!charge.groupId) { out.skipped.push({ allocationId: alloc.id, reason: "guruhsiz charge (o'qituvchi yo'q)" }); continue; }
    if (!payment.receivedAt) { out.skipped.push({ allocationId: alloc.id, reason: "to'lovda receivedAt yo'q (legacy, V2 ga kiritilmagan)" }); continue; }

    const serviceMonth: YearMonth = { year: charge.serviceYear, month: charge.serviceMonth };
    const earningMonth = tashkentYearMonth(payment.receivedAt);
    // S1 cutover qo'riqchisi: legacy xizmat oyi yoki cutover'dan oldingi to'lov (legacy kredit) — avtomatik POSTED emas
    const cutoverReason: EarningReviewReason | null = monthStart(serviceMonth) < cutoverAt ? "LEGACY_SERVICE_MONTH" : payment.receivedAt < cutoverAt ? "PRE_CUTOVER_PAYMENT" : null;
    const policy = await resolveSalaryPolicy(db, charge.branchId, serviceMonth);
    const plans = await planAssignments(db, { groupId: charge.groupId, programId: charge.programId, branchId: charge.branchId, studentId: charge.studentId }, serviceMonth);
    if (plans.length === 0) { out.skipped.push({ allocationId: alloc.id, reason: "xizmat oyida tayinlash yo'q" }); continue; }

    const eligibility = await computeEligibility(db, {
      policy, allocationAmount: alloc.amount, at: alloc.allocatedAt,
      charge: { originalAmount: charge.originalAmount, finalAmount: charge.finalAmount, groupId: charge.groupId, studentId: charge.studentId, serviceMonth },
    });

    for (const plan of plans) {
      const idempotencyKey = `alloc:${alloc.id}:asg:${plan.assignment.id}`;
      const already = await db.teacherEarning.findUnique({ where: { idempotencyKey }, select: { id: true } });
      if (already) { out.existing++; continue; }
      const rateBp = plan.rule?.rateBp ?? 0;
      const amount = applyRateBp(eligibility.eligible, rateBp);
      const reviewReason = cutoverReason ?? plan.reviewReason ?? eligibility.reviewReason;
      if (amount === 0 && !reviewReason && !policy.includeZeroAmounts) continue;
      const status = reviewReason ? "NEEDS_REVIEW" : "POSTED";
      const settlement = status === "POSTED" ? await settlementPeriodFor(db, plan.assignment.teacherId, earningMonth) : null;
      const snapshot = {
        policy: { id: policy.id, version: policy.version, baseMode: policy.salaryBaseMode, attendanceMode: policy.attendanceMode, noLessonsMode: policy.noLessonsMode, splitMode: policy.assignmentSplitMode },
        rule: plan.rule ? { id: plan.rule.id, scope: plan.rule.scope, rateBp: plan.rule.rateBp, effectiveFrom: plan.rule.effectiveFrom.toISOString(), legacy: plan.rule.legacy } : null,
        assignment: { id: plan.assignment.id, role: plan.assignment.role, from: plan.assignment.effectiveFrom.toISOString(), to: plan.assignment.effectiveTo?.toISOString() ?? null, source: plan.assignment.source },
        charge: { id: charge.id, kind: charge.kind, serviceYM: yearMonthKey(serviceMonth), original: charge.originalAmount, discount: charge.discountAmount, final: charge.finalAmount, billingPolicyId: charge.billingPolicyId },
        allocation: { id: alloc.id, kind: alloc.kind, amount: alloc.amount, at: alloc.allocatedAt.toISOString(), source: alloc.source },
        sourcePayment: { id: payment.id, receivedAt: payment.receivedAt.toISOString(), method: payment.method, accountId: payment.financialAccountId },
        attendance: eligibility.attendance ? { ...eligibility.attendance, reason: eligibility.reviewReason } : null,
        studentStatusAtAllocation: eligibility.studentStatus,
        base: eligibility.base, eligible: eligibility.eligible, amount, notes: eligibility.notes, reviewReason,
        earningMonth: yearMonthKey(earningMonth), cutoverAt: cutoverAt.toISOString(), tz: "Asia/Tashkent",
      };
      try {
        const row = await db.teacherEarning.create({
          data: {
            teacherId: plan.assignment.teacherId, studentId: charge.studentId, sourcePaymentId: payment.id, allocationId: alloc.id, chargeId: charge.id,
            groupId: charge.groupId, programId: charge.programId, branchId: charge.branchId, policyId: policy.id, ruleId: plan.rule?.id ?? null, assignmentId: plan.assignment.id,
            serviceYear: serviceMonth.year, serviceMonth: serviceMonth.month, receivedAt: payment.receivedAt, earningYear: earningMonth.year, earningMonth: earningMonth.month,
            settlementPeriodId: settlement?.id ?? null, baseAmount: eligibility.base, eligibleAmount: eligibility.eligible, rateBp: plan.rule ? rateBp : null, amount,
            type: "PAYMENT_COMMISSION", status, reviewReason, snapshot: JSON.stringify(snapshot), idempotencyKey, createdById: ctx.actorId ?? null,
          },
        });
        out.created.push(row);
      } catch (e) {
        if (isUniqueViolation(e)) { out.existing++; continue; }
        throw e;
      }
    }
  }
  return out;
}

/** NEEDS_REVIEW → POSTED (yagona ruxsat etilgan holat o'zgarishi), settlement shu paytda aniqlanadi */
export async function postReviewedEarning(db: FinanceDb, earningId: string, actor: { userId: string }, reason: string): Promise<TeacherEarning> {
  if (reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const e = await db.teacherEarning.findUnique({ where: { id: earningId } });
  if (!e) throw new FinanceError("not_found", "Earning topilmadi");
  if (e.status !== "NEEDS_REVIEW") throw new FinanceError("state", "Faqat NEEDS_REVIEW earning tasdiqlanadi");
  const settlement = await settlementPeriodFor(db, e.teacherId, { year: e.earningYear, month: e.earningMonth });
  const updated = await db.teacherEarning.update({ where: { id: earningId }, data: { status: "POSTED", reviewedAt: new Date(), reviewedById: actor.userId, settlementPeriodId: settlement.id } });
  await financeAudit(db, { actorId: actor.userId, action: "POST", entityType: "TeacherEarning", entityId: earningId, oldValue: { status: "NEEDS_REVIEW", reviewReason: e.reviewReason }, newValue: { status: "POSTED", settlementPeriodId: settlement.id, amount: e.amount }, reason });
  return updated;
}

export interface ManualEarningInput {
  teacherId: string;
  type: "BONUS" | "KPI" | "PENALTY" | "MANUAL_ADJUSTMENT" | "FIXED";
  /** PENALTY va manfiy tuzatish uchun manfiy */
  amount: number;
  earningMonth: YearMonth;
  note: string;
  branchId?: string | null;
  actorId: string;
  /** idempotent: bir xil kalit ikkinchi marta yozilmaydi */
  idempotencyKey: string;
}

/** Qo'lda earning (BONUS/KPI/PENALTY/tuzatish/FIXED) — tarixiy oy, settlement ochiq davrga */
export async function createManualEarning(db: FinanceDb, i: ManualEarningInput): Promise<TeacherEarning> {
  if (!Number.isSafeInteger(i.amount) || i.amount === 0) throw new FinanceError("validation", "Summa butun va 0 dan farqli bo'lishi kerak");
  if (i.type === "PENALTY" && i.amount > 0) throw new FinanceError("validation", "PENALTY manfiy bo'lishi kerak");
  if ((i.type === "BONUS" || i.type === "KPI" || i.type === "FIXED") && i.amount < 0) throw new FinanceError("validation", `${i.type} musbat bo'lishi kerak`);
  if (i.note.trim().length < 3) throw new FinanceError("validation", "Izoh kamida 3 belgi");
  const existing = await db.teacherEarning.findUnique({ where: { idempotencyKey: i.idempotencyKey } });
  if (existing) return existing;
  const settlement = await settlementPeriodFor(db, i.teacherId, i.earningMonth);
  const row = await db.teacherEarning.create({
    data: {
      teacherId: i.teacherId, branchId: i.branchId ?? null, earningYear: i.earningMonth.year, earningMonth: i.earningMonth.month, settlementPeriodId: settlement.id,
      amount: i.amount, type: i.type, status: "POSTED", note: i.note.trim(), snapshot: JSON.stringify({ manual: true, type: i.type, earningMonth: yearMonthKey(i.earningMonth), note: i.note.trim() }),
      idempotencyKey: i.idempotencyKey, createdById: i.actorId,
    },
  });
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "TeacherEarning", entityId: row.id, newValue: { type: i.type, amount: i.amount, earningMonth: yearMonthKey(i.earningMonth), settlementPeriodId: settlement.id }, reason: i.note });
  return row;
}
