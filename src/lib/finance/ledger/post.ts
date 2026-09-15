// Finance V2 — ledger (FinancialTransaction) yozuvi. IMMUTABLE, idempotent:
// idempotencyKey = `${referenceType}:${referenceId}:${direction}:${sequence}`.
// Qayta chaqirilsa mavjud qator qaytadi (dublikat yo'q).

import type { FinancialTransaction } from "@prisma/client";

import { LEDGER_DIRECTIONS, LEDGER_REFERENCE_TYPES, LEDGER_TYPES, type LedgerDirection, type LedgerReferenceType, type LedgerType } from "../constants";
import type { FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { FinanceError } from "../errors";
import { assertPositiveMoney } from "../money";

export interface PostLedgerInput {
  accountId: string;
  branchId?: string | null;
  type: LedgerType;
  direction: LedgerDirection;
  amount: number;
  referenceType: LedgerReferenceType;
  referenceId: string;
  sequence?: number;
  /** manba hujjat biznes sanasi */
  occurredAt: Date;
  note?: string | null;
  actorId?: string | null;
}

export const ledgerKey = (referenceType: string, referenceId: string, direction: string, sequence = 0) => `${referenceType}:${referenceId}:${direction}:${sequence}`;

export async function postLedger(db: FinanceDb, i: PostLedgerInput): Promise<FinancialTransaction> {
  if (!(LEDGER_TYPES as readonly string[]).includes(i.type)) throw new FinanceError("validation", `Ledger turi noto'g'ri: ${i.type}`);
  if (!(LEDGER_DIRECTIONS as readonly string[]).includes(i.direction)) throw new FinanceError("validation", "Yo'nalish IN yoki OUT");
  if (!(LEDGER_REFERENCE_TYPES as readonly string[]).includes(i.referenceType)) throw new FinanceError("validation", `Reference turi noto'g'ri: ${i.referenceType}`);
  assertPositiveMoney(i.amount, "ledger summasi");
  const sequence = i.sequence ?? 0;
  const idempotencyKey = ledgerKey(i.referenceType, i.referenceId, i.direction, sequence);
  const existing = await db.financialTransaction.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  try {
    return await db.financialTransaction.create({
      data: {
        accountId: i.accountId, branchId: i.branchId ?? null, type: i.type, direction: i.direction, amount: i.amount,
        referenceType: i.referenceType, referenceId: i.referenceId, sequence, occurredAt: i.occurredAt, note: i.note ?? null,
        idempotencyKey, createdById: i.actorId ?? null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return db.financialTransaction.findUniqueOrThrow({ where: { idempotencyKey } });
    throw e;
  }
}
