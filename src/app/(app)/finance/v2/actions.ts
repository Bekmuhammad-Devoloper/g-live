"use server";

// Finance V2 — server action'lar (Phase 12/13). Har action: sessiya → RBAC (lib
// ichida) → feature flag (yozuvlar uchun) → dvigatel → revalidate → FinanceResult.
// Moliya jadvallariga yozuv FAQAT src/lib/finance/** orqali (writer scan).

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireSession, type SessionUser } from "@/lib/auth";
import { MAX_MONEY, ROLES } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { setSetting } from "@/lib/settings";
import { FINANCE_SETTING_KEYS } from "@/lib/finance/constants";
import { withFinanceTx } from "@/lib/finance/db";
import { FinanceError, toFinanceResult, type FinanceResult } from "@/lib/finance/errors";
import { getFinanceFlags } from "@/lib/finance/flags";
import { writeAudit } from "@/lib/audit";
import { financeAudit } from "@/lib/finance/audit";
import { assertBranchAccess, requireFinancePermission, branchScope } from "@/lib/finance/permissions";
import { parseYearMonthKey, monthStart, tashkentYearMonth } from "@/lib/finance/period";
import { acceptPayment, type AcceptPaymentInput } from "@/lib/finance/payments/accept";
import { closePeriod, reopenPeriod } from "@/lib/finance/payments/periodLock";
import { createRefund, reversePayment, type RefundInput } from "@/lib/finance/refunds/refund";
import { settleStudentCredit, syncStudentBilling } from "@/lib/finance/billing/sync";
import { DEFAULT_FEE_SETTING_KEY, branchDefaultFeeKey } from "@/lib/finance/billing/fees";
import { financeReadiness } from "@/lib/finance/readiness";
import { createManualDebtCharge, cancelCharge, replaceCharge, adjustCharge } from "@/lib/finance/billing/charges";
import { createDiscount, endDiscount } from "@/lib/finance/billing/discounts";
import { createExpense, reverseExpense, type ExpenseInput } from "@/lib/finance/expenses/expenses";
import { createAccount, updateAccount, ACCOUNT_MAP_SETTING_KEY } from "@/lib/finance/accounts/accounts";
import { createTransfer, reverseTransfer, type TransferInput } from "@/lib/finance/accounts/transfers";
import { createSalaryPolicyVersion } from "@/lib/finance/salary/policy";
import { createSalaryRule, endSalaryRule, type CreateRuleInput } from "@/lib/finance/salary/rules";
import { assignTeacher, endAssignment } from "@/lib/finance/salary/assignments";
import { createManualEarning, postReviewedEarning, rejectReviewedEarning } from "@/lib/finance/salary/earnings";
import { approveSalaryPeriod, closeSalaryPeriod, createPayout, recalculateSalaryPeriod, reopenSalaryPeriod, type PayoutInput } from "@/lib/finance/salary/periods";
import type { FinancialAccountType } from "@/lib/finance/constants";

type Ok<T = undefined> = FinanceResult<T>;

async function guard(): Promise<SessionUser> {
  const s = await requireSession();
  const flags = await getFinanceFlags();
  if (!flags.enabled) throw new FinanceError("feature_disabled", "Finance V2 yoqilmagan");
  return s;
}

const ok = <T,>(data?: T): Ok<T> => ({ ok: true, data } as Ok<T>);

/** MANAGER o'z filiali — o'quvchi/charge filialiga qarab (server-side branch validation) */
async function assertStudentBranch(s: SessionUser, studentId: string): Promise<void> {
  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { branchId: true } });
  if (!st) throw new FinanceError("not_found", "O'quvchi topilmadi");
  assertBranchAccess(s, st.branchId);
}
/** Faqat haqiqiy o'qituvchi (TEACHER roli) uchun maosh davri/earning */
async function assertTeacher(teacherId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  if (!u || u.role !== ROLES.TEACHER) throw new FinanceError("validation", "O'qituvchi topilmadi");
}
async function assertChargeBranch(s: SessionUser, chargeId: string): Promise<void> {
  const c = await prisma.studentCharge.findUnique({ where: { id: chargeId }, select: { branchId: true } });
  if (!c) throw new FinanceError("not_found", "Charge topilmadi");
  assertBranchAccess(s, c.branchId);
}
const revalidateAll = () => { for (const p of ["/finance/v2", "/finance/v2/payments", "/finance/v2/debtors", "/finance/v2/balances", "/finance/v2/salary", "/finance/v2/accounts", "/finance/v2/expenses", "/finance/v2/refunds", "/finance/v2/reports", "/students", "/finance"]) revalidatePath(p); };

// ─── Feature flag (faqat DIRECTOR) ───
export async function setFinanceV2Enabled(enabled: boolean): Promise<Ok> {
  try {
    const s = await requireSession();
    if (s.role !== ROLES.DIRECTOR) throw new FinanceError("forbidden", "Faqat direktor");
    if (enabled) {
      // Go-live readiness: BLOCKER bo'lsa flag yoqilmaydi (narxsiz o'quvchi, MAIN'siz guruh, backfill, migratsiya, DIRECTOR...)
      const r = await financeReadiness(prisma);
      if (!r.ready) {
        const codes = r.issues.filter((i) => i.severity === "BLOCKER").map((i) => `${i.code} (${i.count})`).join(", ");
        throw new FinanceError("state", `Finance V2 yoqilmadi — tayyorlik tekshiruvi: ${codes}. /finance/v2/readiness sahifasini ko'ring`, { blockers: r.blockers });
      }
    }
    await setSetting(FINANCE_SETTING_KEYS.enabled, enabled ? "true" : "false");
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Setting", entityId: FINANCE_SETTING_KEYS.enabled, newValue: { enabled }, reason: "Finance V2 feature flag" });
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

/** Standart oylik narx (global yoki filial) — Setting finance.defaultMonthlyFee[.<branchId>]; bo'sh = o'chirish */
export async function setDefaultFeeAction(branchId: string | null, amount: number | null): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCE_PERIOD_CLOSE");
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_MONEY)) throw new FinanceError("validation", "Narx musbat butun so'm bo'lishi kerak");
    const key = branchId ? branchDefaultFeeKey(branchId) : DEFAULT_FEE_SETTING_KEY;
    if (amount === null) await prisma.setting.deleteMany({ where: { key } });
    else await setSetting(key, String(amount));
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Setting", entityId: key, newValue: { amount }, reason: "Standart oylik narx" });
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

/** O'quvchi bilan kelishilgan oylik narx (narx manbai #1) — StudentDiscount.type = AGREED_PRICE */
export async function setAgreedPriceAction(studentId: string, amount: number, effectiveFrom: string, reason: string, groupId?: string | null): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    await assertStudentBranch(s, studentId);
    const d = await withFinanceTx(prisma, (tx) => createDiscount(tx, { studentId, groupId: groupId ?? null, type: "AGREED_PRICE", value: amount, effectiveFrom: monthStart(parseYearMonthKey(effectiveFrom)), reason, actorId: s.userId }));
    revalidateAll();
    return ok({ id: d.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function setAccountMap(json: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    const parsed = JSON.parse(json) as Record<string, string>;
    await setSetting(ACCOUNT_MAP_SETTING_KEY, JSON.stringify(parsed));
    await financeAudit(prisma, { actorId: s.userId, action: "UPDATE", entityType: "FinancialAccount", entityId: "accountMap", newValue: parsed });
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── To'lovlar ───
export async function acceptPaymentAction(input: AcceptPaymentInput): Promise<Ok<{ paymentId: string; allocated: number; credit: number; docNumber: string | null }>> {
  try {
    const s = await guard();
    const r = await acceptPayment(prisma, input, s);
    if (!r.replayed) {
      // Bildirishnoma — commit'dan keyin, xato to'lovga ta'sir qilmaydi
      try {
        const full = await prisma.student.findUnique({ where: { id: r.payment.studentId }, select: { userId: true, parents: { select: { parent: { select: { userId: true } } } } } });
        const sum = r.payment.amount.toLocaleString("ru-RU");
        const title = { uz: "To'lov qabul qilindi", ru: "Платёж принят", en: "Payment received", de: "Zahlung erhalten" };
        const body = { uz: `To'lov qabul qilindi: ${sum} so'm. Chek № ${r.payment.docNumber ?? ""}.`, ru: `Платёж принят: ${sum} сум. Чек № ${r.payment.docNumber ?? ""}.`, en: `Payment received: ${sum} UZS. Receipt No. ${r.payment.docNumber ?? ""}.`, de: `Zahlung erhalten: ${sum} UZS. Beleg Nr. ${r.payment.docNumber ?? ""}.` };
        if (full?.userId) await notify({ userId: full.userId, title, body, event: "payment_success" });
        for (const l of full?.parents ?? []) if (l.parent.userId) await notify({ userId: l.parent.userId, title, body, event: "payment_success" });
      } catch (e) { console.error("finance v2: notify", e); }
    }
    revalidateAll();
    const allocated = r.allocations.reduce((a, x) => a + x.amount, 0);
    return ok({ paymentId: r.payment.id, allocated, credit: r.payment.amount - allocated, docNumber: r.payment.docNumber });
  } catch (e) { return toFinanceResult(e); }
}

export async function refundAction(input: RefundInput): Promise<Ok<{ refundId: string; reversed: number; adjustments: number }>> {
  try {
    const s = await guard();
    const r = await createRefund(prisma, input, s);
    revalidateAll();
    return ok({ refundId: r.refund.id, reversed: r.reversals.reduce((a, x) => a + x.amount, 0), adjustments: r.adjustments.length });
  } catch (e) { return toFinanceResult(e); }
}

export async function reversePaymentAction(paymentId: string, reason: string, idempotencyKey: string, replacement?: Omit<AcceptPaymentInput, "studentId"> | null): Promise<Ok<{ replacementId: string | null }>> {
  try {
    const s = await guard();
    const r = await reversePayment(prisma, { paymentId, reason, idempotencyKey, replacement: replacement ?? null }, s);
    revalidateAll();
    return ok({ replacementId: r.replacement?.id ?? null });
  } catch (e) { return toFinanceResult(e); }
}

// ─── Billing ───
/** Barcha (filial doirasidagi) o'quvchilar uchun joriy oygacha charge'lar */
export async function syncBillingAction(): Promise<Ok<{ students: number; created: number }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCE_VIEW");
    const scope = branchScope(s);
    const students = await prisma.student.findMany({ where: scope ? { branchId: scope.branchId } : {}, select: { id: true } });
    let created = 0;
    for (const st of students) {
      const r = await withFinanceTx(prisma, (tx) => syncStudentBilling(tx, { studentId: st.id, actorId: s.userId }));
      created += r.created.length;
    }
    revalidateAll();
    return ok({ students: students.length, created });
  } catch (e) { return toFinanceResult(e); }
}

export async function manualDebtAction(studentId: string, amount: number, serviceMonth: string, note: string): Promise<Ok<{ chargeId: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT"); // qo'lda qarz = billing tuzatish (ADMIN/MANAGER emas)
    await assertStudentBranch(s, studentId);
    const c = await withFinanceTx(prisma, async (tx) => {
      const charge = await createManualDebtCharge(tx, { studentId, amount, serviceMonth: parseYearMonthKey(serviceMonth), note, actorId: s.userId });
      await settleStudentCredit(tx, studentId, s.userId); // mavjud kredit yangi qarzga darhol qo'llanadi
      return charge;
    });
    revalidateAll();
    return ok({ chargeId: c.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function cancelChargeAction(chargeId: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    await assertChargeBranch(s, chargeId);
    await withFinanceTx(prisma, (tx) => cancelCharge(tx, chargeId, reason, s.userId));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function replaceChargeAction(chargeId: string, originalAmount: number, discountAmount: number, reason: string): Promise<Ok<{ chargeId: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    await assertChargeBranch(s, chargeId);
    const c = await withFinanceTx(prisma, async (tx) => {
      const charge = await replaceCharge(tx, { chargeId, originalAmount, discountAmount, reason, actorId: s.userId });
      await settleStudentCredit(tx, charge.studentId, s.userId);
      return charge;
    });
    revalidateAll();
    return ok({ chargeId: c.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function adjustChargeAction(chargeId: string, amount: number, reason: string): Promise<Ok<{ chargeId: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    await assertChargeBranch(s, chargeId);
    const c = await withFinanceTx(prisma, async (tx) => {
      const charge = await adjustCharge(tx, { chargeId, amount, reason, actorId: s.userId });
      await settleStudentCredit(tx, charge.studentId, s.userId);
      return charge;
    });
    revalidateAll();
    return ok({ chargeId: c.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function createDiscountAction(studentId: string, type: "PERCENT" | "FIXED" | "AGREED_PRICE", value: number, effectiveFrom: string, reason: string, groupId?: string | null): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    await assertStudentBranch(s, studentId);
    const d = await withFinanceTx(prisma, (tx) => createDiscount(tx, { studentId, groupId: groupId ?? null, type, value: type === "PERCENT" ? Math.round(value * 100) : value, effectiveFrom: monthStart(parseYearMonthKey(effectiveFrom)), reason, actorId: s.userId }));
    revalidateAll();
    return ok({ id: d.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function endDiscountAction(id: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "PAYMENT_CORRECT");
    const d = await prisma.studentDiscount.findUnique({ where: { id }, select: { studentId: true } });
    if (!d) throw new FinanceError("not_found", "Chegirma topilmadi");
    await assertStudentBranch(s, d.studentId);
    await withFinanceTx(prisma, (tx) => endDiscount(tx, id, new Date(), s.userId, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── Xarajatlar ───
export async function createExpenseAction(input: ExpenseInput): Promise<Ok<{ expenseId: string }>> {
  try {
    const s = await guard();
    const r = await createExpense(prisma, input, s);
    revalidateAll();
    return ok({ expenseId: r.expense.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function reverseExpenseAction(expenseId: string, reason: string, idempotencyKey: string): Promise<Ok> {
  try {
    const s = await guard();
    await reverseExpense(prisma, { expenseId, reason, idempotencyKey }, s);
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── Kassalar ───
export async function createAccountAction(name: string, type: FinancialAccountType, branchId: string | null, openingBalance: number, note?: string | null): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCIAL_TRANSFER");
    const a = await withFinanceTx(prisma, (tx) => createAccount(tx, { name, type, branchId, openingBalance, note, actorId: s.userId }));
    revalidateAll();
    return ok({ id: a.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function updateAccountAction(id: string, name: string, isActive: boolean, note?: string | null): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCIAL_TRANSFER");
    await withFinanceTx(prisma, (tx) => updateAccount(tx, { id, name, isActive, note, actorId: s.userId }));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function transferAction(input: TransferInput): Promise<Ok<{ transferId: string }>> {
  try {
    const s = await guard();
    const r = await createTransfer(prisma, input, s);
    revalidateAll();
    return ok({ transferId: r.transfer.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function reverseTransferAction(transferId: string, reason: string, idempotencyKey: string): Promise<Ok> {
  try {
    const s = await guard();
    await reverseTransfer(prisma, { transferId, reason, idempotencyKey }, s);
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── Maosh sozlamalari ───
export async function createSalaryRuleAction(input: Omit<CreateRuleInput, "effectiveFrom" | "actorId"> & { effectiveFrom: string; ratePercent?: number }): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    const r = await withFinanceTx(prisma, (tx) => createSalaryRule(tx, { ...input, rateBp: input.component === "PERCENT" ? Math.round((input.ratePercent ?? 0) * 100) : undefined, effectiveFrom: monthStart(parseYearMonthKey(input.effectiveFrom)), actorId: s.userId }));
    revalidateAll();
    return ok({ id: r.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function endSalaryRuleAction(id: string, effectiveTo: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    await withFinanceTx(prisma, (tx) => endSalaryRule(tx, id, monthStart(parseYearMonthKey(effectiveTo)), s.userId, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function createSalaryPolicyAction(input: { name: string; branchId?: string | null; effectiveFrom: string; salaryBaseMode?: string; attendanceMode?: string; requireConfirmedAttendance?: boolean; includeArchivedStudents?: boolean; includeFrozenStudents?: boolean; includeZeroAmounts?: boolean; note?: string | null }): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    const p = await withFinanceTx(prisma, (tx) => createSalaryPolicyVersion(tx, { ...input, effectiveFrom: monthStart(parseYearMonthKey(input.effectiveFrom)), actorId: s.userId }));
    revalidateAll();
    return ok({ id: p.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function assignTeacherAction(groupId: string, teacherId: string, role: "MAIN" | "ASSISTANT", effectiveFrom: string, compensationRuleId?: string | null): Promise<Ok<{ id: string }>> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    const a = await withFinanceTx(prisma, (tx) => assignTeacher(tx, { groupId, teacherId, role, effectiveFrom: new Date(effectiveFrom), compensationRuleId: compensationRuleId ?? null, actorId: s.userId }));
    revalidateAll();
    return ok({ id: a.id });
  } catch (e) { return toFinanceResult(e); }
}

export async function endAssignmentAction(id: string, effectiveTo: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_RULE_MANAGE");
    await withFinanceTx(prisma, (tx) => endAssignment(tx, id, new Date(effectiveTo), s.userId, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── Maosh davrlari ───
export async function recalculatePeriodAction(teacherId: string, ym: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_VIEW");
    if (s.role === ROLES.TEACHER) throw new FinanceError("forbidden", "O'qituvchi hisoblay olmaydi");
    await assertTeacher(teacherId);
    await withFinanceTx(prisma, (tx) => recalculateSalaryPeriod(tx, teacherId, parseYearMonthKey(ym), { userId: s.userId }));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function approvePeriodAction(periodId: string, note?: string): Promise<Ok> {
  try {
    const s = await guard();
    await withFinanceTx(prisma, (tx) => approveSalaryPeriod(tx, periodId, s, note));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function payoutAction(input: PayoutInput): Promise<Ok<{ payoutId: string; status: string }>> {
  try {
    const s = await guard();
    const r = await createPayout(prisma, input, s);
    revalidateAll();
    return ok({ payoutId: r.payout.id, status: r.period.status });
  } catch (e) { return toFinanceResult(e); }
}

export async function closePeriodAction(periodId: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    await withFinanceTx(prisma, (tx) => closeSalaryPeriod(tx, periodId, s, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function reopenPeriodAction(periodId: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    await withFinanceTx(prisma, (tx) => reopenSalaryPeriod(tx, periodId, s, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function postEarningAction(earningId: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_APPROVE");
    await withFinanceTx(prisma, (tx) => postReviewedEarning(tx, earningId, { userId: s.userId }, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function rejectEarningAction(earningId: string, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_APPROVE");
    await withFinanceTx(prisma, (tx) => rejectReviewedEarning(tx, earningId, { userId: s.userId }, reason));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function manualEarningAction(teacherId: string, type: "BONUS" | "KPI" | "PENALTY" | "MANUAL_ADJUSTMENT", amount: number, ym: string, note: string, idempotencyKey: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "SALARY_APPROVE");
    if (!(["BONUS", "KPI", "PENALTY", "MANUAL_ADJUSTMENT"] as const).includes(type)) throw new FinanceError("validation", "Earning turi noto'g'ri");
    await assertTeacher(teacherId);
    await withFinanceTx(prisma, (tx) => createManualEarning(tx, { teacherId, type, amount, earningMonth: parseYearMonthKey(ym), note, actorId: s.userId, idempotencyKey }));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

// ─── Moliya davri qulfi ───
export async function lockFinancePeriodAction(ym: string, branchId: string | null, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCE_PERIOD_CLOSE");
    await withFinanceTx(prisma, (tx) => closePeriod(tx, { branchId, ym: parseYearMonthKey(ym), reason, actorId: s.userId }));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function unlockFinancePeriodAction(ym: string, branchId: string | null, reason: string): Promise<Ok> {
  try {
    const s = await guard();
    requireFinancePermission(s, "FINANCE_PERIOD_REOPEN");
    await withFinanceTx(prisma, (tx) => reopenPeriod(tx, { branchId, ym: parseYearMonthKey(ym), reason, actorId: s.userId }));
    revalidateAll();
    return ok();
  } catch (e) { return toFinanceResult(e); }
}

export async function currentMonthKey(): Promise<string> {
  const ym = tashkentYearMonth(new Date());
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}
