// Finance V2 — o'quvchi chegirmasi (S6). Sozlama mutable, lekin charge
// yaratilganda hisob `StudentCharge.snapshot` + `discountAmount` da immutable
// qoladi (keyin sozlama o'zgarsa invoice o'zgarmaydi).
//
// Bir nechta faol chegirma bo'lsa ULAR QO'SHILMAYDI — eng kattasi (deterministik,
// konservativ) qo'llanadi; snapshot'da hammasi ko'rinadi.

import type { StudentDiscount } from "@prisma/client";

import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertMoney, assertRateBp, discountAmount as calcDiscount } from "../money";
import { isWithin, monthStart, type YearMonth } from "../period";

export interface AppliedDiscount {
  id: string;
  type: string;
  value: number;
  amount: number;
}

export interface DiscountResolution {
  /** qo'llangan (eng katta) — bo'lmasa null */
  applied: AppliedDiscount | null;
  /** o'sha oyda faol bo'lgan barcha nomzodlar */
  candidates: AppliedDiscount[];
}

/** Xizmat oyi boshida faol chegirmalar: o'quvchi + (shu guruh yoki guruhsiz) */
export async function resolveDiscount(db: FinanceDb, studentId: string, groupId: string | null, serviceMonth: YearMonth, originalAmount: number): Promise<DiscountResolution> {
  const at = monthStart(serviceMonth);
  const rows = await db.studentDiscount.findMany({ where: { studentId, isActive: true, OR: [{ groupId: null }, ...(groupId ? [{ groupId }] : [])] } });
  const candidates = rows
    .filter((d) => isWithin(at, d.effectiveFrom, d.effectiveTo))
    .map((d) => ({ id: d.id, type: d.type, value: d.value, amount: calcDiscount(originalAmount, d.type as "PERCENT" | "FIXED", d.value) }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  return { applied: candidates[0] ?? null, candidates };
}

export interface CreateDiscountInput {
  studentId: string;
  groupId?: string | null;
  type: "PERCENT" | "FIXED";
  /** PERCENT: basis point (2000 = 20%); FIXED: so'm */
  value: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
  actorId?: string | null;
}

export async function createDiscount(db: FinanceDb, input: CreateDiscountInput): Promise<StudentDiscount> {
  if (input.type === "PERCENT") assertRateBp(input.value, "chegirma foizi");
  else assertMoney(input.value, "chegirma summasi");
  if (input.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new FinanceError("validation", "effectiveTo effectiveFrom'dan keyin bo'lishi kerak");
  const created = await db.studentDiscount.create({
    data: {
      studentId: input.studentId, groupId: input.groupId ?? null, type: input.type, value: input.value,
      effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, reason: input.reason.trim(), createdById: input.actorId ?? null,
    },
  });
  await financeAudit(db, { actorId: input.actorId, action: "CREATE", entityType: "StudentDiscount", entityId: created.id, newValue: { ...input, actorId: undefined }, reason: input.reason });
  return created;
}

/** Chegirmani to'xtatish — o'chirilmaydi, `effectiveTo`/`isActive` bilan yopiladi (mavjud charge'lar o'zgarmaydi) */
export async function endDiscount(db: FinanceDb, id: string, at: Date, actorId?: string | null, reason?: string): Promise<void> {
  const d = await db.studentDiscount.findUnique({ where: { id } });
  if (!d) throw new FinanceError("not_found", "Chegirma topilmadi");
  await db.studentDiscount.update({ where: { id }, data: { effectiveTo: at, isActive: false } });
  await financeAudit(db, { actorId, action: "UPDATE", entityType: "StudentDiscount", entityId: id, oldValue: { effectiveTo: d.effectiveTo, isActive: d.isActive }, newValue: { effectiveTo: at, isActive: false }, reason: reason ?? null });
}
