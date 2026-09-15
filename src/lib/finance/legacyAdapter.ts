import "server-only";

// Finance V2 — legacy action'lar uchun adapter (dual-run). Flag O'CHIQ bo'lsa legacy
// kod avvalgidek ishlaydi; YOQILGAN bo'lsa legacy formalar V2 dvigateliga yo'naltiriladi
// yoki (tarixni buzadigan amallar) bloklanadi. Legacy fayllarga faqat bir qatorli
// erta-qaytish qo'shiladi; moliya yozuvlari shu yerda (src/lib/finance) bajariladi.

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { withFinanceTx } from "./db";
import { isFinanceError } from "./errors";
import { getFinanceFlags } from "./flags";
import { acceptPayment } from "./payments/accept";
import { createManualDebtCharge } from "./billing/charges";
import { reversePayment } from "./refunds/refund";
import { createExpense } from "./expenses/expenses";
import { tashkentYearMonth } from "./period";

/** Flag yoqilganmi (legacy action'lar boshida tekshiriladi) */
export async function financeV2Enabled(): Promise<boolean> {
  return (await getFinanceFlags()).enabled;
}

/** Legacy formada idempotency kaliti yo'q — bir xil ma'lumot bir daqiqa ichida ikki marta yuborilsa bitta to'lov */
function legacyKey(parts: (string | number | null | undefined)[]): string {
  const minute = Math.floor(Date.now() / 60_000);
  return "legacy:" + createHash("sha256").update([...parts, minute].join("|")).digest("hex").slice(0, 40);
}

export interface LegacyPaymentInput {
  studentId: string;
  amount: number;
  method: string;
  purpose: string;
  paidAt?: Date | null;
  receiptUrl?: string | null;
  docNumber?: string | null;
  note?: string | null;
}

export type LegacyResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; message: string };

/** Legacy `acceptPayment` / `createManualPayment` → V2 acceptPayment */
export async function legacyAcceptPayment(s: SessionUser, i: LegacyPaymentInput): Promise<LegacyResult<{ paymentId: string; docNumber: string | null; receivedAt: Date }>> {
  try {
    const receivedAt = i.paidAt ?? new Date();
    const r = await acceptPayment(prisma, {
      studentId: i.studentId, amount: Math.trunc(i.amount), method: i.method.toUpperCase(), receivedAt, purpose: i.purpose || "Kurs to'lovi",
      receiptUrl: i.receiptUrl ?? null, docNumber: i.docNumber || undefined, note: i.note ?? null,
      idempotencyKey: legacyKey([s.userId, i.studentId, i.amount, i.method, receivedAt.toISOString(), i.docNumber]),
    }, s);
    return { ok: true, data: { paymentId: r.payment.id, docNumber: r.payment.docNumber, receivedAt } };
  } catch (e) {
    return { ok: false, error: isFinanceError(e) ? e.code : "conflict", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Legacy `addStudentDebt` (PENDING to'lov) → V2 MANUAL_DEBT charge */
export async function legacyAddDebt(s: SessionUser, studentId: string, amount: number, note: string | null): Promise<LegacyResult<{ chargeId: string }>> {
  try {
    const c = await withFinanceTx(prisma, (tx) => createManualDebtCharge(tx, { studentId, amount: Math.trunc(amount), serviceMonth: tashkentYearMonth(new Date()), note, actorId: s.userId }));
    return { ok: true, data: { chargeId: c.id } };
  } catch (e) {
    return { ok: false, error: isFinanceError(e) ? e.code : "conflict", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Legacy `cancelPayment` (status CANCELLED) — V2 ga kiritilgan to'lov uchun correction (reversal) */
export async function legacyCancelPayment(s: SessionUser, paymentId: string, reason: string): Promise<LegacyResult> {
  try {
    const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { postedAt: true, legacyRole: true, status: true } });
    if (!p) return { ok: false, error: "not_found", message: "To'lov topilmadi" };
    if (!p.postedAt || p.legacyRole) return { ok: false, error: "state", message: "Eski to'lov — V2 ga kiritilmagan; backfill'dan keyin V2 orqali tuzatiladi" };
    await reversePayment(prisma, { paymentId, reason, idempotencyKey: legacyKey(["cancel", paymentId, s.userId]) }, s);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: isFinanceError(e) ? e.code : "conflict", message: e instanceof Error ? e.message : String(e) };
  }
}

/** V2 ga kiritilgan to'lov legacy tahrir/o'chirish bilan o'zgartirilmaydi */
export async function isV2Payment(paymentId: string): Promise<boolean> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { postedAt: true } });
  return !!p?.postedAt;
}

export interface LegacyExpenseInput {
  name: string;
  amount: number;
  date: Date;
  method: string;
  categoryId?: string | null;
  recipient?: string | null;
  note?: string | null;
  branchId?: string | null;
}

/** Legacy `createExpense` → V2 createExpense (ledger OUT) */
export async function legacyCreateExpense(s: SessionUser, i: LegacyExpenseInput): Promise<LegacyResult<{ expenseId: string }>> {
  try {
    const r = await createExpense(prisma, { ...i, amount: Math.trunc(i.amount), idempotencyKey: legacyKey([s.userId, i.name, i.amount, i.date.toISOString(), i.method]) }, s);
    return { ok: true, data: { expenseId: r.expense.id } };
  } catch (e) {
    return { ok: false, error: isFinanceError(e) ? e.code : "conflict", message: e instanceof Error ? e.message : String(e) };
  }
}
