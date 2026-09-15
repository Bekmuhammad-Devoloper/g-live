// Finance V2 — allocation yozilgandan keyingi ish: o'qituvchi ulushi (Phase 6).
// Alohida fayl — allocate.ts ↔ salary o'rtasida aylanma import bo'lmasin.

import type { PaymentAllocation } from "@prisma/client";

import type { FinanceDb } from "../db";
import { createEarningsForAllocations } from "../salary/earnings";

export interface AfterAllocationContext {
  actorId?: string | null;
}

/** Har ALLOCATION uchun TeacherEarning (idempotent). Backfill/testda `skipAfterHooks` bilan o'chiriladi. */
export async function afterAllocations(db: FinanceDb, allocations: PaymentAllocation[], ctx: AfterAllocationContext): Promise<void> {
  await createEarningsForAllocations(db, allocations, { actorId: ctx.actorId });
}
