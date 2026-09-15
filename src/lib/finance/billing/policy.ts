// Finance V2 — BillingPolicy (versiyali). Filial → global, xizmat oyi bo'yicha.
// Yozuv bo'lmasa in-memory STANDART qaytadi (o'qishda hech narsa yaratilmaydi).

import type { BillingPolicy } from "@prisma/client";

import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { isTashkentMonthStart, monthStart, type YearMonth } from "../period";

export interface BillingPolicyView {
  id: string | null;
  name: string;
  version: number;
  branchId: string | null;
  midMonthJoinMode: string;
  dueDay: number;
  frozenFullMonthMode: string;
  noEnrollmentMode: string;
}

/** Yozuv bo'lmaganda ishlatiladigan tasdiqlangan standart (S3, S4, S20) */
export const DEFAULT_BILLING_POLICY: BillingPolicyView = {
  id: null,
  name: "Standart",
  version: 0,
  branchId: null,
  midMonthJoinMode: "FULL_MONTH",
  dueDay: 1,
  frozenFullMonthMode: "ZERO_CHARGE",
  noEnrollmentMode: "NO_CHARGE",
};

function toView(p: BillingPolicy): BillingPolicyView {
  return {
    id: p.id, name: p.name, version: p.version, branchId: p.branchId,
    midMonthJoinMode: p.midMonthJoinMode, dueDay: p.dueDay, frozenFullMonthMode: p.frozenFullMonthMode, noEnrollmentMode: p.noEnrollmentMode,
  };
}

/** Xizmat oyi uchun faol siyosat: avval filial, keyin global; `effectiveFrom ≤ oy boshi < effectiveTo` */
export async function resolveBillingPolicy(db: FinanceDb, branchId: string | null, serviceMonth: YearMonth): Promise<BillingPolicyView> {
  const at = monthStart(serviceMonth);
  const candidates = await db.billingPolicy.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: at },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
        branchId ? { OR: [{ branchId }, { branchId: null }] } : { branchId: null },
      ],
    },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
  // Filial qatori global'dan ustun
  const branchHit = branchId ? candidates.find((c) => c.branchId === branchId) : undefined;
  const hit = branchHit ?? candidates.find((c) => c.branchId === null);
  return hit ? toView(hit) : DEFAULT_BILLING_POLICY;
}

export interface CreateBillingPolicyInput {
  name: string;
  branchId?: string | null;
  effectiveFrom: Date; // Tashkent oy boshi
  midMonthJoinMode?: string;
  dueDay?: number;
  frozenFullMonthMode?: string;
  noEnrollmentMode?: string;
  note?: string | null;
  actorId?: string | null;
}

/**
 * Yangi VERSIYA: shu nom+filial bo'yicha oxirgi versiya `effectiveTo` bilan yopiladi
 * (mutate qilinmaydi), yangisi `version+1`. `effectiveFrom` oy boshi bo'lishi shart.
 */
export async function createBillingPolicyVersion(db: FinanceDb, input: CreateBillingPolicyInput): Promise<BillingPolicy> {
  if (!isTashkentMonthStart(input.effectiveFrom)) throw new FinanceError("validation", "effectiveFrom Tashkent oy boshi bo'lishi kerak");
  if (input.dueDay !== undefined && (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 28)) {
    throw new FinanceError("validation", "dueDay 1..28 oralig'ida bo'lishi kerak");
  }
  if (input.midMonthJoinMode && input.midMonthJoinMode !== "FULL_MONTH") {
    throw new FinanceError("validation", "Hozircha faqat FULL_MONTH qo'llab-quvvatlanadi (S3)");
  }
  const branchId = input.branchId ?? null;
  const prev = await db.billingPolicy.findFirst({ where: { name: input.name, branchId }, orderBy: { version: "desc" } });
  if (prev && prev.effectiveFrom >= input.effectiveFrom) {
    throw new FinanceError("validation", "Yangi versiya oldingisidan keyingi oydan boshlanishi kerak");
  }
  if (prev && prev.effectiveTo === null) {
    await db.billingPolicy.update({ where: { id: prev.id }, data: { effectiveTo: input.effectiveFrom } });
  }
  const created = await db.billingPolicy.create({
    data: {
      name: input.name, branchId, version: (prev?.version ?? 0) + 1, effectiveFrom: input.effectiveFrom,
      midMonthJoinMode: input.midMonthJoinMode ?? "FULL_MONTH", dueDay: input.dueDay ?? 1,
      frozenFullMonthMode: input.frozenFullMonthMode ?? "ZERO_CHARGE", noEnrollmentMode: input.noEnrollmentMode ?? "NO_CHARGE",
      note: input.note ?? null, createdById: input.actorId ?? null,
    },
  });
  await financeAudit(db, {
    actorId: input.actorId, action: "CREATE", entityType: "BillingPolicy", entityId: created.id,
    oldValue: prev ? { id: prev.id, version: prev.version } : null, newValue: toView(created),
  });
  return created;
}
