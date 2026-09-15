// Finance V2 — allocation yozilgandan keyingi ish: o'qituvchi ulushi.
// Phase 4 da bo'sh; Phase 6 da to'g'ridan-to'g'ri `createEarningsForAllocations`
// chaqiriladi. Alohida fayl — allocate.ts ↔ salary o'rtasida aylanma import bo'lmasin.

import type { PaymentAllocation } from "@prisma/client";

import type { FinanceDb } from "../db";

export interface AfterAllocationContext {
  actorId?: string | null;
}

export async function afterAllocations(_db: FinanceDb, _allocations: PaymentAllocation[], _ctx: AfterAllocationContext): Promise<void> {
  // Phase 6: TeacherEarning dvigateli shu yerdan ulanadi
}
