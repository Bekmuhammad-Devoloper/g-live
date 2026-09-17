// Finance V2 — to'lovni majburiyatlarga taqsimlash (FIFO, immutable qatorlar).
//
//   • Eng eski xizmat oyi birinchi (serviceYear, serviceMonth, dueDate, createdAt)
//   • Σ allocation ≤ to'lovning taqsimlanmagan qismi; ≤ charge qoldig'i
//   • Kredit (avans) — taqsimlanmagan qoldiq; keyingi charge paydo bo'lganda
//     `applyStudentCredit` har MANBA TO'LOV uchun alohida qator yozadi (lineage)
//   • idempotencyKey = alloc:{paymentId}:{chargeId}:{seq} — bir juftlikka bir necha
//     marta (turli vaqtda) taqsimlash mumkin, seq mavjud qatorlar sonidan

import type { PaymentAllocation } from "@prisma/client";

import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { assertMoney } from "../money";
import { OPEN_CHARGE_STATUSES, chargeAllocationSums, paymentAvailability, refreshChargeStatus, remainingOf } from "../billing/balance";
import { afterAllocations } from "./afterAllocation";

export interface OpenChargeLine {
  id: string;
  remaining: number;
}

/** O'quvchining ochiq charge'lari FIFO tartibida, qoldiq bilan */
export async function openChargesFifo(db: FinanceDb, studentId: string): Promise<OpenChargeLine[]> {
  const charges = await db.studentCharge.findMany({
    where: { studentId, status: { in: [...OPEN_CHARGE_STATUSES] } },
    orderBy: [{ serviceYear: "asc" }, { serviceMonth: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, finalAmount: true },
  });
  const sums = await chargeAllocationSums(db, charges.map((c) => c.id));
  return charges.map((c) => ({ id: c.id, remaining: remainingOf(c.finalAmount, sums.get(c.id)) })).filter((c) => c.remaining > 0);
}

export interface AllocateOptions {
  paymentId: string;
  studentId: string;
  /** shu to'lovdan taqsimlash mumkin bo'lgan eng ko'p summa; to'lovning real taqsimlanmagan qismidan oshsa xato */
  available: number;
  source: "AUTO_FIFO" | "CREDIT_APPLY" | "MANUAL" | "BACKFILL";
  actorId?: string | null;
  allocatedAt?: Date;
  /** Phase 6+: earning dvigatelini chaqirmaslik (backfill, test) */
  skipAfterHooks?: boolean;
}

/** Bitta to'lovni FIFO taqsimlaydi; yozilgan qatorlarni qaytaradi */
export async function allocateFifo(db: FinanceDb, o: AllocateOptions): Promise<PaymentAllocation[]> {
  assertMoney(o.available, "taqsimlanadigan summa");
  if (o.available === 0) return [];
  // Himoya: to'lovdan uning real taqsimlanmagan qismidan ko'p taqsimlab bo'lmaydi
  const avail = (await paymentAvailability(db, [o.paymentId])).get(o.paymentId);
  if (!avail) throw new FinanceError("not_found", "To'lov topilmadi");
  if (o.available > avail.unallocated) throw new FinanceError("conflict", "To'lovning taqsimlanmagan qismidan ko'p taqsimlash mumkin emas", { available: o.available, unallocated: avail.unallocated });
  const charges = await openChargesFifo(db, o.studentId);
  const created: PaymentAllocation[] = [];
  let left = o.available;
  for (const c of charges) {
    if (left <= 0) break;
    const amount = Math.min(left, c.remaining);
    if (amount <= 0) continue;
    const seq = await db.paymentAllocation.count({ where: { paymentId: o.paymentId, chargeId: c.id } });
    const row = await db.paymentAllocation.create({
      data: {
        paymentId: o.paymentId, chargeId: c.id, amount, kind: "ALLOCATION", source: o.source,
        allocatedAt: o.allocatedAt ?? new Date(), idempotencyKey: `alloc:${o.paymentId}:${c.id}:${seq}`, createdById: o.actorId ?? null,
      },
    });
    created.push(row);
    left -= amount;
    await refreshChargeStatus(db, c.id);
  }
  // Himoya: tranzaksiya ichida qayta tekshiruv — hech bir charge ortiqcha taqsimlanmagan
  for (const c of created) {
    const ch = await db.studentCharge.findUniqueOrThrow({ where: { id: c.chargeId }, select: { finalAmount: true } });
    const rem = remainingOf(ch.finalAmount, (await chargeAllocationSums(db, [c.chargeId])).get(c.chargeId));
    if (rem < 0) throw new FinanceError("conflict", "Charge ortiqcha taqsimlandi — tranzaksiya bekor", { chargeId: c.chargeId, remaining: rem });
  }
  if (created.length && !o.skipAfterHooks) await afterAllocations(db, created, { actorId: o.actorId });
  return created;
}

/**
 * O'quvchining mavjud kreditini (taqsimlanmagan to'lovlar, eng eski receivedAt
 * birinchi) ochiq charge'larga qo'llaydi — har manba to'lov alohida qator.
 */
export async function applyStudentCredit(db: FinanceDb, studentId: string, o: { actorId?: string | null; source?: "CREDIT_APPLY" | "BACKFILL"; skipAfterHooks?: boolean; excludePaymentId?: string; /** faqat shu lahzadan OLDIN qabul qilingan to'lovlar (backfill: legacy) */ receivedBefore?: Date } = {}): Promise<PaymentAllocation[]> {
  const payments = await db.payment.findMany({
    where: { studentId, status: "PAID", legacyRole: null, postedAt: { not: null }, ...(o.excludePaymentId ? { id: { not: o.excludePaymentId } } : {}), ...(o.receivedBefore ? { receivedAt: { lt: o.receivedBefore } } : {}) },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const avail = await paymentAvailability(db, payments.map((p) => p.id));
  const out: PaymentAllocation[] = [];
  for (const p of payments) {
    const a = avail.get(p.id);
    if (!a || a.unallocated <= 0) continue;
    const rows = await allocateFifo(db, { paymentId: p.id, studentId, available: a.unallocated, source: o.source ?? "CREDIT_APPLY", actorId: o.actorId, skipAfterHooks: o.skipAfterHooks });
    out.push(...rows);
    if (rows.length === 0) break; // ochiq charge qolmadi
  }
  return out;
}

/**
 * Aniq charge'ga taqsimot (tarixiy tiklash / qo'lda): summa to'lovning taqsimlanmagan qismidan va charge qoldig'idan
 * oshmaydi; tranzaksiya ichida qayta tekshiriladi. Earning hook'i chaqirilmaydi (tarixiy o'qituvchi konteksti alohida,
 * aniq qaror bilan).
 */
export async function allocateToCharge(db: FinanceDb, o: { paymentId: string; chargeId: string; amount: number; source: "MANUAL" | "BACKFILL"; actorId?: string | null; allocatedAt?: Date }): Promise<PaymentAllocation> {
  assertMoney(o.amount, "taqsimot summasi");
  if (o.amount <= 0) throw new FinanceError("validation", "Taqsimot summasi musbat bo'lishi kerak");
  const avail = (await paymentAvailability(db, [o.paymentId])).get(o.paymentId);
  if (!avail) throw new FinanceError("not_found", "To'lov topilmadi");
  if (o.amount > avail.unallocated) throw new FinanceError("conflict", "To'lovning taqsimlanmagan qismidan ko'p", { unallocated: avail.unallocated, requested: o.amount });
  const charge = await db.studentCharge.findUnique({ where: { id: o.chargeId } });
  if (!charge) throw new FinanceError("not_found", "Charge topilmadi");
  if (!OPEN_CHARGE_STATUSES.includes(charge.status as (typeof OPEN_CHARGE_STATUSES)[number])) throw new FinanceError("state", `Charge ochiq emas (${charge.status})`);
  const payment = await db.payment.findUniqueOrThrow({ where: { id: o.paymentId }, select: { studentId: true } });
  if (payment.studentId !== charge.studentId) throw new FinanceError("validation", "To'lov va charge boshqa o'quvchilarga tegishli");
  const remaining = remainingOf(charge.finalAmount, (await chargeAllocationSums(db, [charge.id])).get(charge.id));
  if (o.amount > remaining) throw new FinanceError("conflict", "Charge qoldig'idan ko'p", { remaining, requested: o.amount });
  const seq = await db.paymentAllocation.count({ where: { paymentId: o.paymentId, chargeId: charge.id } });
  const row = await db.paymentAllocation.create({
    data: { paymentId: o.paymentId, chargeId: charge.id, amount: o.amount, kind: "ALLOCATION", source: o.source, allocatedAt: o.allocatedAt ?? new Date(), idempotencyKey: `alloc:${o.paymentId}:${charge.id}:${seq}`, createdById: o.actorId ?? null },
  });
  await refreshChargeStatus(db, charge.id);
  const rem = remainingOf(charge.finalAmount, (await chargeAllocationSums(db, [charge.id])).get(charge.id));
  if (rem < 0) throw new FinanceError("conflict", "Charge ortiqcha taqsimlandi — tranzaksiya bekor", { chargeId: charge.id, remaining: rem });
  return row;
}
