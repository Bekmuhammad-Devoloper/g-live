import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { createTransferTx } from "@/lib/finance/accounts/transfers";
import { withFinanceTx, type FinanceDb } from "@/lib/finance/db";
import { createExpenseTx } from "@/lib/finance/expenses/expenses";
import { acceptPayment, acceptPaymentTx } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefundTx } from "@/lib/finance/refunds/refund";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { approveSalaryPeriod, createPayoutTx, recalculateSalaryPeriod } from "@/lib/finance/salary/periods";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// ATOMIKLIK — pul oqimi o'rtasida xato: yoki HAMMASI commit, yoki HECH NARSA. Xato tranzaksiya klientining
// aniq model/amaliga in'ektsiya qilinadi (Proxy); tashqi holat (sonlar, ledger) o'zgarmasligi tekshiriladi.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const OCT: YearMonth = { year: 2026, month: 10 };
const FEE = 1_000_000;

/** `db[model][op]` N-chi chaqiruvda tashlaydi (1 = birinchi) */
function failing(db: FinanceDb, model: string, op: string, onCall = 1): FinanceDb {
  let calls = 0;
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== model || typeof value !== "object" || value === null) return value;
      return new Proxy(value, {
        get(m, mp, r) {
          const fn = Reflect.get(m, mp, r);
          if (mp !== op || typeof fn !== "function") return fn;
          return (...args: unknown[]) => { calls++; if (calls === onCall) throw new Error(`INJECTED ${model}.${op} #${onCall}`); return (fn as (...a: unknown[]) => unknown).apply(m, args); };
        },
      });
    },
  }) as FinanceDb;
}

describe("atomicity / failure injection", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; director: string; cash: string; bank: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `at-${s}-${String(++n).padStart(4, "0")}`;
  async function mkStudent(name: string) {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
    await db.prisma.groupStudent.create({ data: { groupId: ids.group, studentId: s.id, joinedAt: monthStart(OCT) } });
    return s;
  }
  const snapshot = async () => {
    const p = db.prisma;
    return {
      payments: await p.payment.count(), allocations: await p.paymentAllocation.count(), earnings: await p.teacherEarning.count(), refunds: await p.refund.count(),
      payouts: await p.salaryPayout.count(), transfers: await p.transfer.count(), expenses: await p.expense.count(), ledger: await p.financialTransaction.count(), audit: await p.auditLog.count(),
      ledgerSum: (await p.financialTransaction.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0,
    };
  };

  beforeAll(async () => {
    db = createTestDb("atomicity");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "G", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, group: group.id, teacher: t.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("to'lov yaratildi, ledger yozuvida xato → Payment ham yozilmaydi", async () => {
    const s = await mkStudent("A");
    const before = await snapshot();
    await expect(withFinanceTx(db.prisma, (tx) => acceptPaymentTx(failing(tx, "financialTransaction", "create"), { studentId: s.id, amount: FEE, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key("p") }, director, T("2026-10-05T05:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
  });

  it("taqsimot yaratildi, earning yaratishda xato → Payment/allocation/ledger yozilmaydi (charge ham)", async () => {
    const s = await mkStudent("B");
    const before = await snapshot();
    await expect(withFinanceTx(db.prisma, (tx) => acceptPaymentTx(failing(tx, "teacherEarning", "create"), { studentId: s.id, amount: FEE, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key("p") }, director, T("2026-10-05T05:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
    expect(await db.prisma.studentCharge.count({ where: { studentId: s.id } })).toBe(0);
    // Keyin xatosiz — normal ishlaydi (in'ektsiya iz qoldirmagan)
    const ok = await acceptPayment(db.prisma, { studentId: s.id, amount: FEE, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key("p") }, director, T("2026-10-05T05:00:00Z"));
    expect(ok.allocations).toHaveLength(1);
  });

  it("qaytarim yaratildi, ledger OUT yozuvida xato → Refund/REVERSAL/adjustment yozilmaydi", async () => {
    const s = await mkStudent("C");
    const r = await acceptPayment(db.prisma, { studentId: s.id, amount: FEE, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key("p") }, director, T("2026-10-05T05:00:00Z"));
    const before = await snapshot();
    await expect(withFinanceTx(db.prisma, (tx) => createRefundTx(failing(tx, "financialTransaction", "create"), { paymentId: r.payment.id, amount: 300_000, reason: "Qaytarim", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: key("r") }, director, T("2026-10-06T05:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
    // Taqsimot teskarisi ham yo'q; asl earning o'zgarmagan
    expect(await db.prisma.paymentAllocation.count({ where: { paymentId: r.payment.id, kind: "REVERSAL" } })).toBe(0);
    expect(await db.prisma.teacherEarning.count({ where: { sourcePaymentId: r.payment.id, type: "REFUND_ADJUSTMENT" } })).toBe(0);
  });

  it("payout yaratildi, kassa OUT yozuvida xato → SalaryPayout yozilmaydi, davr holati o'zgarmaydi", async () => {
    const s = await mkStudent("D");
    await acceptPayment(db.prisma, { studentId: s.id, amount: FEE, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: key("p") }, director, T("2026-10-05T05:00:00Z"));
    const period = await recalculateSalaryPeriod(db.prisma, ids.teacher, OCT, { userId: ids.director });
    await approveSalaryPeriod(db.prisma, period.id, director);
    const before = await snapshot();
    const statusBefore = (await db.prisma.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } })).status;
    await expect(withFinanceTx(db.prisma, (tx) => createPayoutTx(failing(tx, "financialTransaction", "create"), { salaryPeriodId: period.id, amount: 100_000, financialAccountId: ids.cash, paidAt: T("2026-11-01T05:00:00Z"), idempotencyKey: key("po") }, director, T("2026-11-01T05:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
    expect((await db.prisma.salaryPeriod.findUniqueOrThrow({ where: { id: period.id } })).status).toBe(statusBefore);
  });

  it("transfer: FROM (OUT) yozildi, TO (IN) yozuvida xato → Transfer ham, OUT ham yozilmaydi (balanslar o'zgarmaydi)", async () => {
    const before = await snapshot();
    await expect(withFinanceTx(db.prisma, (tx) => createTransferTx(failing(tx, "financialTransaction", "create", 2), { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 50_000, occurredAt: T("2026-10-20T05:00:00Z"), idempotencyKey: key("tr") }, director, T("2026-10-20T05:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
  });

  it("xarajat: Expense yozildi, ledger OUT xato → Expense yozilmaydi; audit ham yo'q", async () => {
    const before = await snapshot();
    await expect(withFinanceTx(db.prisma, (tx) => createExpenseTx(failing(tx, "financialTransaction", "create"), { name: "Ijara", amount: 30_000, date: T("2026-10-21T05:00:00Z"), method: "CASH", branchId: ids.branch, idempotencyKey: key("ex") }, director, T("2026-10-21T06:00:00Z")), { attempts: 1 })).rejects.toThrow(/INJECTED/);
    expect(await snapshot()).toEqual(before);
  });
});
