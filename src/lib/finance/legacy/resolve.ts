// Finance V2 — legacy real to'lovni QO'LDA hal qilish (inson qarori, audit bilan). Avtomatik taxmin yo'q.
//   · allocateHistoricalPayment — tarixiy hisobga bog'lash: mavjud ochiq charge yoki yangi HISTORICAL charge
//     (xizmat oyi, summa, ixtiyoriy guruh) — to'lov o'zgarmaydi, allocation lineage `PaymentAllocation`
//   · resolveHistoricalTeacher — aniq o'qituvchi + foiz bilan tarixiy ulush: NEEDS_REVIEW (HISTORICAL_RECONSTRUCTION),
//     tasdiqlangach oddiy oqim; foiz taxmin qilinmaydi — chaqiruvchi beradi (UI o'sha xizmat oyi qoidasini taklif qiladi)
//   · markLegacyAsAdvance — faqat aniq sabab bilan: to'lov V2 kreditiga aylanadi (legacyRole = null); keyingi
//     charge'da qo'llanadi, ulush esa cutover qo'riqchisi tufayli NEEDS_REVIEW (PRE_CUTOVER_PAYMENT)
//   · leaveUnresolved — hal qilinmagan deb belgilash (summa saqlanadi, kredit emas)

import { randomUUID } from "node:crypto";
import type { PaymentAllocation, StudentCharge, TeacherEarning } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { financeAudit } from "../audit";
import { paymentAvailability } from "../billing/balance";
import { resolveBillingPolicy } from "../billing/policy";
import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { applyRateBp, assertPositiveMoney, assertRateBp } from "../money";
import { allocateToCharge } from "../payments/allocate";
import { assertBranchAccess, requireFinancePermission } from "../permissions";
import { monthStart, tashkentDate, tashkentYearMonth, yearMonthKey, type YearMonth } from "../period";
import { LEGACY_HISTORICAL_ROLE } from "./preserve";

type Actor = Pick<SessionUser, "userId" | "role" | "branchId">;

async function loadReview(db: FinanceDb, paymentId: string) {
  const review = await db.legacyPaymentReview.findUnique({ where: { paymentId }, include: { payment: { select: { id: true, studentId: true, amount: true, legacyRole: true, branchId: true, receivedAt: true, createdAt: true, status: true } } } });
  if (!review) throw new FinanceError("not_found", "Legacy to'lov ko'rib chiqish yozuvi topilmadi");
  if (review.payment.status !== "PAID") throw new FinanceError("state", "To'lov PAID emas");
  if (review.payment.amount !== review.amount) throw new FinanceError("conflict", "To'lov summasi ko'rib chiqish yozuvidan farq qiladi — invariant buzilgan", { payment: review.payment.amount, review: review.amount });
  return review;
}

async function finishIfFullyAllocated(db: FinanceDb, paymentId: string, actorId: string, reason: string, resolution: "ALLOCATED"): Promise<boolean> {
  const avail = (await paymentAvailability(db, [paymentId])).get(paymentId)!;
  if (avail.unallocated > 0) return false;
  await db.legacyPaymentReview.update({ where: { paymentId }, data: { status: "RESOLVED", resolution, resolvedById: actorId, resolvedAt: new Date(), reason } });
  return true;
}

export interface AllocateHistoricalInput {
  paymentId: string;
  amount: number;
  /** mavjud ochiq charge (o'quvchining) — yoki yangi HISTORICAL charge */
  chargeId?: string | null;
  newCharge?: { serviceMonth: YearMonth; amount: number; groupId?: string | null; note?: string | null } | null;
  reason: string;
}

/** Tarixiy hisobga bog'lash (PAYMENT_CORRECT). To'lov o'zgarmaydi; charge (kerak bo'lsa) + allocation yaratiladi. */
export async function allocateHistoricalPayment(db: FinanceDb, i: AllocateHistoricalInput, actor: Actor): Promise<{ charge: StudentCharge; allocation: PaymentAllocation; resolved: boolean }> {
  requireFinancePermission(actor, "PAYMENT_CORRECT");
  if (i.reason.trim().length < 5) throw new FinanceError("validation", "Sabab kamida 5 belgi (dalilga havola bilan)");
  assertPositiveMoney(i.amount, "taqsimot summasi");
  const review = await loadReview(db, i.paymentId);
  const student = await db.student.findUniqueOrThrow({ where: { id: review.studentId }, select: { id: true, branchId: true } });
  assertBranchAccess(actor, student.branchId);
  // Oldindan tekshiruv (charge yaratishdan OLDIN): summa to'lovning taqsimlanmagan qismidan oshmasin
  const avail = (await paymentAvailability(db, [review.paymentId])).get(review.paymentId);
  if (!avail || i.amount > avail.unallocated) throw new FinanceError("insufficient", "Taqsimot summasi to'lovning taqsimlanmagan qismidan oshadi", { unallocated: avail?.unallocated ?? 0, requested: i.amount });
  let charge: StudentCharge;
  if (i.chargeId) {
    const c = await db.studentCharge.findUnique({ where: { id: i.chargeId } });
    if (!c || c.studentId !== student.id) throw new FinanceError("not_found", "Charge topilmadi (shu o'quvchiniki emas)");
    charge = c;
  } else if (i.newCharge) {
    assertPositiveMoney(i.newCharge.amount, "charge summasi");
    const ym = i.newCharge.serviceMonth;
    if (monthStart(ym) >= new Date(review.receivedAt.getTime() + 366 * 24 * 3600 * 1000)) throw new FinanceError("validation", "Xizmat oyi to'lovdan bir yildan ko'p keyin bo'lishi mumkin emas");
    let groupMeta: { programId: string | null; branchId: string | null; name: string } | null = null;
    if (i.newCharge.groupId) {
      const g = await db.group.findUnique({ where: { id: i.newCharge.groupId }, select: { programId: true, branchId: true, name: true } });
      if (!g) throw new FinanceError("not_found", "Guruh topilmadi (o'chirilgan guruh uchun guruhsiz charge yarating)");
      groupMeta = g;
    }
    const policy = await resolveBillingPolicy(db, groupMeta?.branchId ?? student.branchId, ym);
    charge = await db.studentCharge.create({
      data: {
        studentId: student.id, branchId: groupMeta?.branchId ?? student.branchId, groupId: i.newCharge.groupId ?? null, programId: groupMeta?.programId ?? null,
        billingPolicyId: policy.id, kind: "HISTORICAL", serviceYear: ym.year, serviceMonth: ym.month,
        originalAmount: i.newCharge.amount, discountAmount: 0, finalAmount: i.newCharge.amount, dueDate: tashkentDate(ym, policy.dueDay), status: "OPEN",
        chargeKey: `historical:${student.id}:${yearMonthKey(ym)}:${randomUUID()}`, // poyga xavfsiz, MAX(N)+1 emas
        snapshot: JSON.stringify({ kind: "HISTORICAL", reconstruction: true, fromPaymentId: review.paymentId, reason: i.reason, group: groupMeta?.name ?? null, note: i.newCharge.note ?? null, actorId: actor.userId, generatedAt: new Date().toISOString() }),
        createdById: actor.userId,
      },
    });
    await financeAudit(db, { actorId: actor.userId, action: "CREATE", entityType: "StudentCharge", entityId: charge.id, newValue: { kind: "HISTORICAL", serviceMonth: yearMonthKey(ym), amount: i.newCharge.amount, groupId: i.newCharge.groupId ?? null, fromPaymentId: review.paymentId }, reason: `HISTORICAL_RECONSTRUCTION: ${i.reason}` });
  } else throw new FinanceError("validation", "chargeId yoki newCharge kerak");
  const allocation = await allocateToCharge(db, { paymentId: review.paymentId, chargeId: charge.id, amount: i.amount, source: "MANUAL", actorId: actor.userId, allocatedAt: review.receivedAt });
  const resolved = await finishIfFullyAllocated(db, review.paymentId, actor.userId, i.reason, "ALLOCATED");
  await financeAudit(db, { actorId: actor.userId, action: "ALLOCATE", entityType: "LegacyPaymentReview", entityId: review.paymentId, oldValue: { status: review.status, resolution: review.resolution }, newValue: { chargeId: charge.id, amount: i.amount, resolved, serviceMonth: yearMonthKey({ year: charge.serviceYear, month: charge.serviceMonth }) }, reason: i.reason });
  return { charge: await db.studentCharge.findUniqueOrThrow({ where: { id: charge.id } }), allocation, resolved }; // holat (PAID/PARTIALLY_PAID) taqsimotdan keyin
}

export interface HistoricalTeacherInput {
  allocationId: string;
  teacherId: string;
  /** aniq foiz (bp) — chaqiruvchi beradi (UI: o'sha xizmat oyi qoidasi taklif sifatida ko'rsatiladi) */
  rateBp: number;
  reason: string;
}

/** Tarixiy o'qituvchi ulushi — NEEDS_REVIEW (HISTORICAL_RECONSTRUCTION); tasdiqlash oddiy oqimda */
export async function resolveHistoricalTeacher(db: FinanceDb, i: HistoricalTeacherInput, actor: Actor): Promise<TeacherEarning> {
  requireFinancePermission(actor, "SALARY_APPROVE");
  if (i.reason.trim().length < 5) throw new FinanceError("validation", "Sabab kamida 5 belgi");
  assertRateBp(i.rateBp);
  const alloc = await db.paymentAllocation.findUnique({ where: { id: i.allocationId }, include: { charge: true, payment: { select: { id: true, studentId: true, receivedAt: true, createdAt: true, branchId: true, method: true, financialAccountId: true, legacyRole: true } } } });
  if (!alloc || alloc.kind !== "ALLOCATION") throw new FinanceError("not_found", "Taqsimot topilmadi");
  if (!(await db.legacyPaymentReview.findUnique({ where: { paymentId: alloc.paymentId } }))) throw new FinanceError("state", "Bu to'lov legacy ko'rib chiqish ro'yxatida emas");
  const teacher = await db.user.findUnique({ where: { id: i.teacherId }, select: { id: true, role: true, fullName: true } });
  if (!teacher || teacher.role !== "TEACHER") throw new FinanceError("validation", "O'qituvchi topilmadi");
  const idempotencyKey = `hist:${alloc.id}:${teacher.id}`;
  const existing = await db.teacherEarning.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  const receivedAt = alloc.payment.receivedAt ?? alloc.payment.createdAt;
  const earningMonth = tashkentYearMonth(receivedAt);
  const amount = applyRateBp(alloc.amount, i.rateBp);
  const row = await db.teacherEarning.create({
    data: {
      teacherId: teacher.id, studentId: alloc.payment.studentId, sourcePaymentId: alloc.paymentId, allocationId: alloc.id, chargeId: alloc.chargeId,
      groupId: alloc.charge.groupId, programId: alloc.charge.programId, branchId: alloc.charge.branchId, ruleId: null, assignmentId: null,
      serviceYear: alloc.charge.serviceYear, serviceMonth: alloc.charge.serviceMonth, receivedAt, earningYear: earningMonth.year, earningMonth: earningMonth.month,
      settlementPeriodId: null, baseAmount: alloc.amount, eligibleAmount: alloc.amount, rateBp: i.rateBp, amount,
      type: "PAYMENT_COMMISSION", status: "NEEDS_REVIEW", reviewReason: "HISTORICAL_RECONSTRUCTION",
      snapshot: JSON.stringify({ reconstruction: true, allocation: { id: alloc.id, amount: alloc.amount }, sourcePayment: { id: alloc.paymentId, receivedAt: receivedAt.toISOString(), legacyRole: alloc.payment.legacyRole }, charge: { id: alloc.chargeId, kind: alloc.charge.kind, serviceYM: yearMonthKey({ year: alloc.charge.serviceYear, month: alloc.charge.serviceMonth }) }, rateBp: i.rateBp, rateSource: "manual (inson qarori)", reason: i.reason, actorId: actor.userId, earningMonth: yearMonthKey(earningMonth), tz: "Asia/Tashkent" }),
      idempotencyKey, createdById: actor.userId,
    },
  });
  await financeAudit(db, { actorId: actor.userId, action: "CREATE", entityType: "TeacherEarning", entityId: row.id, newValue: { type: "PAYMENT_COMMISSION", status: "NEEDS_REVIEW", reviewReason: "HISTORICAL_RECONSTRUCTION", teacherId: teacher.id, rateBp: i.rateBp, amount, allocationId: alloc.id }, reason: i.reason });
  return row;
}

/** Avans deb tasdiqlash — faqat aniq sabab/dalil bilan; to'lov V2 kreditiga aylanadi (keyingi charge'da qo'llanadi) */
export async function markLegacyAsAdvance(db: FinanceDb, i: { paymentId: string; reason: string }, actor: Actor): Promise<void> {
  requireFinancePermission(actor, "PAYMENT_CORRECT");
  if (i.reason.trim().length < 10) throw new FinanceError("validation", "Avans qarori uchun sabab/dalil kamida 10 belgi");
  const review = await loadReview(db, i.paymentId);
  const student = await db.student.findUniqueOrThrow({ where: { id: review.studentId }, select: { branchId: true } });
  assertBranchAccess(actor, student.branchId);
  if (review.payment.legacyRole !== LEGACY_HISTORICAL_ROLE) throw new FinanceError("state", "To'lov HISTORICAL holatida emas");
  await db.payment.update({ where: { id: i.paymentId }, data: { legacyRole: null } });
  await db.legacyPaymentReview.update({ where: { paymentId: i.paymentId }, data: { status: "RESOLVED", resolution: "ADVANCE", resolvedById: actor.userId, resolvedAt: new Date(), reason: i.reason } });
  await financeAudit(db, { actorId: actor.userId, action: "UPDATE", entityType: "LegacyPaymentReview", entityId: i.paymentId, oldValue: { legacyRole: LEGACY_HISTORICAL_ROLE, status: review.status }, newValue: { legacyRole: null, resolution: "ADVANCE" }, reason: i.reason });
}

/** Hal qilinmagan deb belgilash (summa saqlanadi; kredit emas; keyinroq qayta ko'rib chiqiladi) */
export async function leaveLegacyUnresolved(db: FinanceDb, i: { paymentId: string; reason: string }, actor: Actor): Promise<void> {
  requireFinancePermission(actor, "PAYMENT_CORRECT");
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const review = await loadReview(db, i.paymentId);
  await db.legacyPaymentReview.update({ where: { paymentId: i.paymentId }, data: { resolution: "UNRESOLVED", reason: i.reason, resolvedById: actor.userId, resolvedAt: new Date() } });
  await financeAudit(db, { actorId: actor.userId, action: "UPDATE", entityType: "LegacyPaymentReview", entityId: i.paymentId, oldValue: { resolution: review.resolution }, newValue: { resolution: "UNRESOLVED" }, reason: i.reason });
}

/** Ko'rib chiqishni qayta ochish (RESOLVED → NEEDS_REVIEW) — masalan avans qarori qaytarilsa; faqat taqsimlanmagan bo'lsa */
export async function reopenLegacyReview(db: FinanceDb, i: { paymentId: string; reason: string }, actor: Actor): Promise<void> {
  requireFinancePermission(actor, "PAYMENT_CORRECT");
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const review = await loadReview(db, i.paymentId);
  const avail = (await paymentAvailability(db, [i.paymentId])).get(i.paymentId)!;
  if (review.resolution === "ADVANCE") {
    if (avail.allocated - avail.reversed > 0) throw new FinanceError("state", "Avans allaqachon charge'ga qo'llangan — qaytarib bo'lmaydi (correction orqali)");
    await db.payment.update({ where: { id: i.paymentId }, data: { legacyRole: LEGACY_HISTORICAL_ROLE } });
  }
  await db.legacyPaymentReview.update({ where: { paymentId: i.paymentId }, data: { status: "NEEDS_REVIEW", resolution: null, reason: i.reason } });
  await financeAudit(db, { actorId: actor.userId, action: "REOPEN", entityType: "LegacyPaymentReview", entityId: i.paymentId, oldValue: { status: review.status, resolution: review.resolution }, newValue: { status: "NEEDS_REVIEW" }, reason: i.reason });
}
