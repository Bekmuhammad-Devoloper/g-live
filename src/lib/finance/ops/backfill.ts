// Finance V2 — legacy ma'lumotni V2 ga ko'chirish (backfill). IDEMPOTENT:
// har bosqich qayta ishga tushirilsa dublikat yozmaydi (chargeKey, legacyPaymentId,
// idempotencyKey). Har bosqich o'quvchi/yozuv bo'yicha alohida tranzaksiyada —
// yarim holatda qolsa keyingi ishga tushirish davom ettiradi.
//
// Bosqichlar (phase bo'yicha to'ldiriladi):
//   billing  — tarix (INFERRED) + MONTHLY charge'lar + eski PENDING → MANUAL_DEBT   (Phase 3)
//   payments — eski PAID → postedAt + ledger + FIFO allocation; REFUNDED → Refund   (Phase 4)
//   salary   — TeacherSalary → SalaryPeriod{LEGACY}                                    (Phase 8)
//
// TeacherEarning backfill YO'Q (S1): INFERRED assignment asosida moliyaviy fakt yaratilmaydi.

import type { Prisma, PrismaClient } from "@prisma/client";

import { withFinanceTx } from "../db";
import { createManualDebtCharge, ensureMonthlyCharges } from "../billing/charges";
import { syncStudentHistory } from "../billing/history";
import { tashkentYearMonth, type YearMonth } from "../period";

export interface BackfillOptions {
  /** Yozmaydi — faqat nima qilinishini hisoblaydi */
  dryRun?: boolean;
  cutoverAt?: Date;
  /** Charge'lar shu oygacha (default: joriy Tashkent oyi) */
  upTo?: YearMonth;
  now?: Date;
  actorId?: string | null;
  /** Bir tranzaksiyada nechta o'quvchi */
  batchSize?: number;
  log?: (line: string) => void;
}

export interface BillingBackfillReport {
  students: number;
  historyChanged: number;
  chargesCreated: number;
  chargesExisting: number;
  chargesSkipped: number;
  manualDebtsCreated: number;
  manualDebtsExisting: number;
  createdAmount: number;
  manualDebtAmount: number;
  dryRun: boolean;
}

/**
 * BILLING bosqichi. Dry-run: tarix sinxroni va charge yaratish tranzaksiya
 * ichida bajarilib, oxirida ATAYLAB rollback qilinadi (aniq raqamlar, yozuv yo'q).
 */
export async function backfillBilling(client: PrismaClient, o: BackfillOptions = {}): Promise<BillingBackfillReport> {
  const now = o.now ?? new Date();
  const upTo = o.upTo ?? tashkentYearMonth(now);
  const batchSize = o.batchSize ?? 25;
  const log = o.log ?? (() => {});
  const report: BillingBackfillReport = { students: 0, historyChanged: 0, chargesCreated: 0, chargesExisting: 0, chargesSkipped: 0, manualDebtsCreated: 0, manualDebtsExisting: 0, createdAmount: 0, manualDebtAmount: 0, dryRun: !!o.dryRun };

  const students = await client.student.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  report.students = students.length;

  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    const runBatch = async (tx: Prisma.TransactionClient): Promise<void> => {
      for (const { id } of batch) {
        const changed = await syncStudentHistory(tx, id, { at: now, actorId: o.actorId, cutoverAt: o.cutoverAt });
        if (changed) report.historyChanged++;
        const r = await ensureMonthlyCharges(tx, { studentId: id, upTo, actorId: o.actorId, cutoverAt: o.cutoverAt, now });
        report.chargesCreated += r.created.length;
        report.chargesExisting += r.existing;
        report.chargesSkipped += r.skipped.length;
        report.createdAmount += r.created.reduce((a, c) => a + c.finalAmount, 0);

        // Eski PENDING (qo'lda qarz) → MANUAL_DEBT charge; Payment qatoriga legacyRole="DEBT"
        const pending = await tx.payment.findMany({ where: { studentId: id, status: "PENDING" }, select: { id: true, amount: true, createdAt: true, purpose: true, legacyRole: true } });
        for (const p of pending) {
          const exists = await tx.studentCharge.findUnique({ where: { legacyPaymentId: p.id }, select: { id: true } });
          if (exists) { report.manualDebtsExisting++; continue; }
          if (p.amount <= 0) continue;
          await createManualDebtCharge(tx, { studentId: id, amount: p.amount, serviceMonth: tashkentYearMonth(p.createdAt), note: p.purpose ?? "Eski qarz (legacy PENDING)", legacyPaymentId: p.id, actorId: o.actorId, now });
          if (p.legacyRole !== "DEBT") await tx.payment.update({ where: { id: p.id }, data: { legacyRole: "DEBT" } });
          report.manualDebtsCreated++;
          report.manualDebtAmount += p.amount;
        }
      }
      if (o.dryRun) throw new DryRunRollback();
    };
    try {
      await withFinanceTx(client, runBatch, { attempts: 1, timeout: 120_000 });
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }
    log(`billing: ${Math.min(i + batchSize, students.length)}/${students.length} o'quvchi — charge +${report.chargesCreated} (bor ${report.chargesExisting}), qarz +${report.manualDebtsCreated}`);
  }
  return report;
}

/** Dry-run'da tranzaksiyani rollback qilish uchun maxsus xato */
export class DryRunRollback extends Error {
  constructor() {
    super("dry-run rollback");
    this.name = "DryRunRollback";
  }
}
