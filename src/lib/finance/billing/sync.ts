// Finance V2 — o'quvchi billing sinxronizatsiyasi: tarix → oylik charge'lar → MAVJUD KREDITNI QO'LLASH.
//
// Kredit (taqsimlanmagan to'lov qoldig'i) yangi charge paydo bo'lganda darhol FIFO bilan
// qo'llanadi — oldindan to'lagan o'quvchi qarzdor bo'lib ko'rinmaydi va o'qituvchi ulushi
// (earningMonth = asl to'lov oyi, serviceMonth = yangi charge oyi) keyingi to'lovni kutmaydi.
// Alohida fayl — charges.ts ↔ payments/allocate.ts o'rtasida aylanma import bo'lmasin.

import type { PaymentAllocation, StudentCharge } from "@prisma/client";

import type { FinanceDb } from "../db";
import type { YearMonth } from "../period";
import { applyStudentCredit } from "../payments/allocate";
import { ensureMonthlyCharges } from "./charges";

export interface SyncStudentBillingOptions {
  studentId: string;
  upTo?: YearMonth;
  actorId?: string | null;
  cutoverAt?: Date;
  now?: Date;
}

export interface SyncStudentBillingResult {
  created: StudentCharge[];
  creditApplied: PaymentAllocation[];
}

/** Tranzaksiya ichida chaqiriladi. Idempotent: charge'lar chargeKey, taqsimotlar idempotencyKey bilan. */
export async function syncStudentBilling(db: FinanceDb, o: SyncStudentBillingOptions): Promise<SyncStudentBillingResult> {
  const r = await ensureMonthlyCharges(db, o);
  const creditApplied = await applyStudentCredit(db, o.studentId, { actorId: o.actorId });
  return { created: r.created, creditApplied };
}

/** Qo'lda qarz / almashtirish / tuzatishdan keyin — mavjud kredit yangi charge'ga qo'llanadi */
export async function settleStudentCredit(db: FinanceDb, studentId: string, actorId?: string | null): Promise<PaymentAllocation[]> {
  return applyStudentCredit(db, studentId, { actorId });
}
