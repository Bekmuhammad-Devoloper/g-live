// Finance V2 — allocation yozilgandan keyingi ish: o'qituvchi ulushi (Phase 6).
// Alohida fayl — allocate.ts ↔ salary o'rtasida aylanma import bo'lmasin.

import type { PaymentAllocation } from "@prisma/client";

import { financeAudit } from "../audit";
import type { FinanceDb } from "../db";
import { createEarningsForAllocations } from "../salary/earnings";

export interface AfterAllocationContext {
  actorId?: string | null;
}

/** Har ALLOCATION uchun TeacherEarning (idempotent). Backfill/testda `skipAfterHooks` bilan o'chiriladi. */
export async function afterAllocations(db: FinanceDb, allocations: PaymentAllocation[], ctx: AfterAllocationContext): Promise<void> {
  const out = await createEarningsForAllocations(db, allocations, { actorId: ctx.actorId });
  if (out.created.length === 0 && out.skipped.length === 0) return;
  // Audit: qaysi allocation'dan qaysi o'qituvchiga qancha (NEEDS_REVIEW ham), o'tkazib yuborilganlar sababi bilan
  await financeAudit(db, {
    actorId: ctx.actorId ?? null, action: "ACCRUE", entityType: "TeacherEarning", entityId: allocations[0]?.paymentId ?? null,
    newValue: {
      created: out.created.map((e) => ({ id: e.id, teacherId: e.teacherId, allocationId: e.allocationId, amount: e.amount, status: e.status, reviewReason: e.reviewReason })),
      skipped: out.skipped,
    },
  });
}
