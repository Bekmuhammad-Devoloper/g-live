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

import { financeAudit } from "../audit";
import { cutoverAtFrom } from "../cutover";
import { withFinanceTx } from "../db";
import { FinanceError } from "../errors";
import { accountForMethod } from "../accounts/accounts";
import { paymentAvailability, studentBalance } from "../billing/balance";
import { createManualDebtCharge, ensureMonthlyCharges } from "../billing/charges";
import { syncStudentHistory } from "../billing/history";
import { postLedger } from "../ledger/post";
import { normalizeExpenseMethod } from "../expenses/expenses";
import { applyStudentCredit } from "../payments/allocate";
import { tashkentYearMonth, type YearMonth } from "../period";

export interface BackfillOptions {
  /** narx belgilanmagan oylarni o'tkazib yuborishga ruxsat (standart: XATO) */
  allowUnpriced?: boolean;
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
  /** narx belgilanmagan guruhlar (guruh id → o'tkazib yuborilgan oylar soni) */
  unpricedGroups: Record<string, number>;
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
  const report: BillingBackfillReport = { students: 0, historyChanged: 0, chargesCreated: 0, chargesExisting: 0, chargesSkipped: 0, unpricedGroups: {}, manualDebtsCreated: 0, manualDebtsExisting: 0, createdAmount: 0, manualDebtAmount: 0, dryRun: !!o.dryRun };

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
        for (const u of r.unpriced) report.unpricedGroups[u.groupId] = (report.unpricedGroups[u.groupId] ?? 0) + 1;
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
  // Narxsiz oy = legacy qarz hisoblanmaydi → to'lovlar soxta "kredit" bo'lib qoladi. Bu moliyaviy faktni taxmin
  // qilish emas, TO'XTASH: avval guruh/kurs narxi (yoki finance.defaultMonthlyFee) kiritiladi, keyin backfill.
  const unpricedMonths = Object.values(report.unpricedGroups).reduce((a, b) => a + b, 0);
  if (unpricedMonths > 0 && !o.allowUnpriced) {
    throw new FinanceError("validation", `Narx belgilanmagan: ${Object.keys(report.unpricedGroups).length} guruh, ${unpricedMonths} o'quvchi-oy — Group.monthlyFee / Program.monthlyFee / Setting finance.defaultMonthlyFee kiriting (yoki --allow-unpriced)`, { unpricedGroups: report.unpricedGroups, dryRun: report.dryRun });
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

// ─── PAYMENTS bosqichi (Phase 4) ───

export interface PaymentsBackfillReport {
  students: number;
  paidPosted: number;
  paidExisting: number;
  paidAmount: number;
  refundsCreated: number;
  refundsExisting: number;
  refundAmount: number;
  allocationsCreated: number;
  allocatedAmount: number;
  dryRun: boolean;
}

/**
 * Eski PAID → V2 ga kiritiladi (receivedAt=createdAt, kassa=usul bo'yicha, postedAt,
 * ledger IN) va FIFO taqsimlanadi (source BACKFILL, earning YO'Q); eski REFUNDED →
 * Refund{LEGACY} + ledger OUT + legacyRole=REFUND. Idempotent.
 */
export async function backfillPayments(client: PrismaClient, o: BackfillOptions = {}): Promise<PaymentsBackfillReport> {
  const now = o.now ?? new Date();
  const cutoverAt = o.cutoverAt ?? (await cutoverAtFrom(client));
  const upTo = o.upTo ?? tashkentYearMonth(now);
  const batchSize = o.batchSize ?? 25;
  const log = o.log ?? (() => {});
  const report: PaymentsBackfillReport = { students: 0, paidPosted: 0, paidExisting: 0, paidAmount: 0, refundsCreated: 0, refundsExisting: 0, refundAmount: 0, allocationsCreated: 0, allocatedAmount: 0, dryRun: !!o.dryRun };
  const students = await client.student.findMany({ select: { id: true, branchId: true }, orderBy: { createdAt: "asc" } });
  report.students = students.length;

  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    const runBatch = async (tx: Prisma.TransactionClient): Promise<void> => {
      for (const st of batch) {
        const payments = await tx.payment.findMany({ where: { studentId: st.id, status: { in: ["PAID", "REFUNDED"] } }, orderBy: [{ createdAt: "asc" }] });
        for (const p of payments) {
          if (p.status === "PAID") {
            if (p.postedAt) { report.paidExisting++; continue; }
            const account = await accountForMethod(tx, st.branchId, p.method, o.actorId);
            const receivedAt = p.receivedAt ?? p.createdAt;
            await tx.payment.update({ where: { id: p.id }, data: { receivedAt, branchId: p.branchId ?? st.branchId, financialAccountId: p.financialAccountId ?? account.id, postedAt: now } });
            await postLedger(tx, { accountId: p.financialAccountId ?? account.id, branchId: p.branchId ?? st.branchId, type: "STUDENT_PAYMENT", direction: "IN", amount: p.amount, referenceType: "Payment", referenceId: p.id, occurredAt: receivedAt, actorId: o.actorId, note: "backfill" });
            report.paidPosted++;
            report.paidAmount += p.amount;
          } else {
            // REFUNDED — eski "yechib olish": asl to'lovga bog'lanmagan (taxmin qilinmaydi)
            const exists = await tx.refund.findUnique({ where: { legacyPaymentId: p.id }, select: { id: true } });
            if (exists) { report.refundsExisting++; continue; }
            const cash = await accountForMethod(tx, st.branchId, "CASH", o.actorId);
            const refund = await tx.refund.create({
              data: {
                originalPaymentId: null, studentId: st.id, branchId: st.branchId, amount: p.amount, reason: p.purpose ?? "Yechib olish (legacy)", kind: "CASH_REFUND",
                financialAccountId: cash.id, refundedAt: p.createdAt, source: "LEGACY", legacyPaymentId: p.id, idempotencyKey: `legacy-refund:${p.id}`, createdById: o.actorId ?? null,
              },
            });
            await postLedger(tx, { accountId: cash.id, branchId: st.branchId, type: "REFUND", direction: "OUT", amount: p.amount, referenceType: "Refund", referenceId: refund.id, occurredAt: p.createdAt, actorId: o.actorId, note: "backfill legacy refund" });
            if (p.legacyRole !== "REFUND") await tx.payment.update({ where: { id: p.id }, data: { legacyRole: "REFUND" } });
            report.refundsCreated++;
            report.refundAmount += p.amount;
          }
        }
        await ensureMonthlyCharges(tx, { studentId: st.id, upTo, actorId: o.actorId, cutoverAt: o.cutoverAt, now });
        // Faqat LEGACY (cutover'dan oldingi) to'lovlar — V2 ga kiritilgan haqiqiy to'lov krediti backfill'da earning'siz taqsimlanmasin
        const allocs = await applyStudentCredit(tx, st.id, { actorId: o.actorId, source: "BACKFILL", skipAfterHooks: true, receivedBefore: cutoverAt });
        report.allocationsCreated += allocs.length;
        report.allocatedAmount += allocs.reduce((a, r) => a + r.amount, 0);
      }
      if (o.dryRun) throw new DryRunRollback();
    };
    try {
      await withFinanceTx(client, runBatch, { attempts: 1, timeout: 120_000 });
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }
    log(`payments: ${Math.min(i + batchSize, students.length)}/${students.length} — posted +${report.paidPosted}, refund +${report.refundsCreated}, alloc +${report.allocationsCreated}`);
  }
  return report;
}

// ─── Tekshiruv: legacy computeDebts ↔ V2 balans ───

export interface DebtVerifyRow {
  studentId: string;
  legacyDebt: number;
  legacyCredit: number;
  v2Debt: number;
  v2Credit: number;
  classification: "EQUAL" | "EXPECTED" | "UNEXPECTED";
}

export interface DebtVerifyReport {
  students: number;
  equal: number;
  expected: number;
  unexpected: number;
  legacyPaidTotal: number;
  v2PostedPaidTotal: number;
  paidTotalsMatch: boolean;
  rows: DebtVerifyRow[];
}

/**
 * Legacy `computeDebts` (o'sha bazadan) bilan V2 balansini solishtiradi.
 * EXPECTED: V2 qarzi ≤ legacy va V2 krediti ≥ legacy (S2 — a'zoliksiz oy hisoblanmaydi,
 * REFUNDED legacy'da e'tiborsiz). UNEXPECTED: V2 ko'proq qarz yoki kamroq kredit ko'rsatsa,
 * yoki PAID yig'indilari farq qilsa — STOP.
 */
export async function verifyDebt(client: PrismaClient, legacyDebts: Map<string, { debt: number; credit: number }>, now = new Date()): Promise<DebtVerifyReport> {
  const students = await client.student.findMany({ select: { id: true } });
  const rows: DebtVerifyRow[] = [];
  for (const s of students) {
    const legacy = legacyDebts.get(s.id) ?? { debt: 0, credit: 0 };
    const v2 = await studentBalance(client, s.id);
    let classification: DebtVerifyRow["classification"] = "UNEXPECTED";
    if (legacy.debt === v2.debt && legacy.credit === v2.credit) classification = "EQUAL";
    else if (v2.debt <= legacy.debt && v2.credit >= legacy.credit) classification = "EXPECTED";
    rows.push({ studentId: s.id, legacyDebt: legacy.debt, legacyCredit: legacy.credit, v2Debt: v2.debt, v2Credit: v2.credit, classification });
  }
  const [legacyPaid, v2Paid] = await Promise.all([
    client.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    client.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", postedAt: { not: null }, legacyRole: null } }),
  ]);
  void now;
  return {
    students: students.length,
    equal: rows.filter((r) => r.classification === "EQUAL").length,
    expected: rows.filter((r) => r.classification === "EXPECTED").length,
    unexpected: rows.filter((r) => r.classification === "UNEXPECTED").length,
    legacyPaidTotal: legacyPaid._sum.amount ?? 0,
    v2PostedPaidTotal: v2Paid._sum.amount ?? 0,
    paidTotalsMatch: (legacyPaid._sum.amount ?? 0) === (v2Paid._sum.amount ?? 0),
    rows,
  };
}

// ─── SALARY bosqichi (Phase 8): TeacherSalary → SalaryPeriod{LEGACY} ───

export interface SalaryBackfillReport {
  rows: number;
  created: number;
  existing: number;
  /** qator bor, lekin V2 davri boshqa manbadan yaratilgan (teacher+oy band) — legacy bog'lanmadi */
  conflicts: { teacherSalaryId: string; period: string }[];
  dryRun: boolean;
}

/**
 * Har TeacherSalary qatori → SalaryPeriod{source LEGACY}: legacyFiksaAmount=fiksa (ichida commission
 * bo'lishi mumkin — ajratilmaydi), bonus/kpi/penalty, gross = fiksa+bonus+kpi−penalty.
 * closed=true → CLOSED (immutable; payout tarixi yo'q → paid/remaining 0, izohda);
 * closed=false → CALCULATED, remaining = gross. Earning yaratilmaydi (S1). Idempotent.
 */
export async function backfillSalary(client: PrismaClient, o: BackfillOptions = {}): Promise<SalaryBackfillReport> {
  const report: SalaryBackfillReport = { rows: 0, created: 0, existing: 0, conflicts: [], dryRun: !!o.dryRun };
  const rows = await client.teacherSalary.findMany({ orderBy: [{ teacherId: "asc" }, { year: "asc" }, { month: "asc" }] });
  report.rows = rows.length;
  const run = async (tx: Prisma.TransactionClient): Promise<void> => {
    for (const r of rows) {
      const linked = await tx.salaryPeriod.findUnique({ where: { legacyTeacherSalaryId: r.id }, select: { id: true } });
      if (linked) { report.existing++; continue; }
      const taken = await tx.salaryPeriod.findUnique({ where: { teacherId_year_month: { teacherId: r.teacherId, year: r.year, month: r.month } } });
      if (taken) { report.conflicts.push({ teacherSalaryId: r.id, period: `${r.year}-${String(r.month).padStart(2, "0")}` }); continue; }
      const gross = r.fiksa + r.bonus + r.kpi - r.penalty;
      const period = await tx.salaryPeriod.create({
        data: {
          teacherId: r.teacherId, year: r.year, month: r.month, status: r.closed ? "CLOSED" : "CALCULATED", source: "LEGACY", legacyTeacherSalaryId: r.id,
          legacyFiksaAmount: r.fiksa, fixedAmount: 0, commissionAmount: 0, bonusAmount: r.bonus, kpiAmount: r.kpi, penaltyAmount: r.penalty,
          grossAmount: gross, paidAmount: 0, remainingAmount: r.closed ? 0 : gross, calculatedAt: r.updatedAt, closedAt: r.closed ? r.updatedAt : null,
          note: r.closed ? "LEGACY: TeacherSalary'dan ko'chirildi; to'lov (payout) tarixi yo'q — yopiq davr majburiyat emas" : "LEGACY: TeacherSalary'dan ko'chirildi (ochiq)",
        },
      });
      // OCHIQ legacy davr: summa TeacherEarning bilan tasdiqlanadi (MANUAL_ADJUSTMENT, legacy manba) — recalc/approve/payout
      // uni 0 ga tushirmaydi va to'lab bo'ladi. Yopiq legacy davr — majburiyat emas (earning yo'q).
      if (!r.closed && gross !== 0) {
        await tx.teacherEarning.create({
          data: {
            teacherId: r.teacherId, earningYear: r.year, earningMonth: r.month, serviceYear: r.year, serviceMonth: r.month, settlementPeriodId: period.id,
            baseAmount: gross, eligibleAmount: gross, amount: gross, type: "MANUAL_ADJUSTMENT", status: "POSTED",
            snapshot: JSON.stringify({ source: "LEGACY", legacyTeacherSalaryId: r.id, fiksa: r.fiksa, bonus: r.bonus, kpi: r.kpi, penalty: r.penalty, note: "legacy TeacherSalary (ochiq) — fiksa+bonus+kpi−penalty" }),
            idempotencyKey: `legacy-salary:${r.id}`, createdById: o.actorId ?? null,
          },
        });
      }
      report.created++;
    }
    if (o.dryRun) throw new DryRunRollback();
  };
  try {
    await withFinanceTx(client, run, { attempts: 1, timeout: 120_000 });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  return report;
}


// ─── EXPENSES bosqichi (Phase 10): legacy Expense → kassa + postedAt + ledger OUT ───

export interface ExpensesBackfillReport {
  rows: number;
  posted: number;
  existing: number;
  amount: number;
  dryRun: boolean;
}

export async function backfillExpenses(client: PrismaClient, o: BackfillOptions = {}): Promise<ExpensesBackfillReport> {
  const now = o.now ?? new Date();
  const report: ExpensesBackfillReport = { rows: 0, posted: 0, existing: 0, amount: 0, dryRun: !!o.dryRun };
  const rows = await client.expense.findMany({ orderBy: { date: "asc" } });
  report.rows = rows.length;
  const run = async (tx: Prisma.TransactionClient): Promise<void> => {
    for (const e of rows) {
      if (e.postedAt) { report.existing++; continue; }
      const { method, methodRaw } = normalizeExpenseMethod(e.method);
      const account = await accountForMethod(tx, e.branchId ?? null, method, o.actorId);
      await tx.expense.update({ where: { id: e.id }, data: { method, methodRaw: e.methodRaw ?? methodRaw, financialAccountId: e.financialAccountId ?? account.id, postedAt: now, status: e.status || "ACTIVE" } });
      await postLedger(tx, { accountId: e.financialAccountId ?? account.id, branchId: e.branchId ?? null, type: "EXPENSE", direction: "OUT", amount: e.amount, referenceType: "Expense", referenceId: e.id, occurredAt: e.date, actorId: o.actorId, note: `backfill: ${e.name}` });
      report.posted++;
      report.amount += e.amount;
    }
    if (o.dryRun) throw new DryRunRollback();
  };
  try {
    await withFinanceTx(client, run, { attempts: 1, timeout: 120_000 });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  return report;
}


// ─── LEGACY KREDIT bosqichi: cutover'dan OLDINGI, hech qaysi charge'ga taqsimlanmagan to'lovlar ───
// Bunday to'lovlar "kredit" emas — o'tgan davr xizmati uchun olingan pul (legacy hisob). Ular V2 kreditiga
// aylanib keyingi oy charge'lariga qo'llanmasligi uchun legacyRole = "SETTLED" belgilanadi (ledger IN qoladi,
// qator o'zgarmaydi, audit). Bu QAROR — buxgalter/direktor tasdig'i bilan (--stage settle-legacy-credit).
export interface LegacyCreditReport {
  candidates: number;
  amount: number;
  settled: number;
  dryRun: boolean;
  /** to'lov id → summa (birinchi 200) */
  sample: { paymentId: string; studentId: string; amount: number; unallocated: number; receivedAt: string }[];
}

export async function listLegacyCredit(client: PrismaClient, cutoverAt: Date): Promise<LegacyCreditReport["sample"]> {
  const payments = await client.payment.findMany({ where: { status: "PAID", legacyRole: null, postedAt: { not: null }, receivedAt: { lt: cutoverAt } }, select: { id: true, studentId: true, amount: true, receivedAt: true } });
  const avail = await paymentAvailability(client, payments.map((p) => p.id));
  return payments
    .map((p) => ({ paymentId: p.id, studentId: p.studentId, amount: p.amount, unallocated: avail.get(p.id)?.unallocated ?? 0, receivedAt: p.receivedAt!.toISOString() }))
    .filter((x) => x.unallocated > 0);
}

export async function settleLegacyCredit(client: PrismaClient, o: BackfillOptions = {}): Promise<LegacyCreditReport> {
  const cutoverAt = o.cutoverAt ?? (await cutoverAtFrom(client));
  const rows = await listLegacyCredit(client, cutoverAt);
  const report: LegacyCreditReport = { candidates: rows.length, amount: rows.reduce((a, r) => a + r.unallocated, 0), settled: 0, dryRun: !!o.dryRun, sample: rows.slice(0, 200) };
  if (o.dryRun || rows.length === 0) return report;
  await withFinanceTx(client, async (tx) => {
    for (const r of rows) {
      // Faqat TO'LIQ taqsimlanmagan to'lov belgilanadi; qisman taqsimlanganida qolgan kredit V2 ga tegishli deb qoladi
      if (r.unallocated !== r.amount) continue;
      await tx.payment.update({ where: { id: r.paymentId }, data: { legacyRole: "SETTLED" } });
      await financeAudit(tx, { actorId: o.actorId ?? null, action: "UPDATE", entityType: "Payment", entityId: r.paymentId, oldValue: { legacyRole: null }, newValue: { legacyRole: "SETTLED", amount: r.amount }, reason: "Legacy (cutover'dan oldingi) to'lov — V2 krediti emas, o'tgan davr xizmati uchun" });
      report.settled++;
    }
  }, { attempts: 1, timeout: 120_000 });
  return report;
}
