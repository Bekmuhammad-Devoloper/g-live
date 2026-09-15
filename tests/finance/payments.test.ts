import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountForMethod, ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { studentBalance } from "@/lib/finance/billing/balance";
import { ensureMonthlyCharges, monthlyChargeKey } from "@/lib/finance/billing/charges";
import { FinanceError } from "@/lib/finance/errors";
import { backfillBilling, backfillPayments, verifyDebt } from "@/lib/finance/ops/backfill";
import { acceptPayment, acceptPaymentTx } from "@/lib/finance/payments/accept";
import { applyStudentCredit } from "@/lib/finance/payments/allocate";
import { closePeriod, reopenPeriod } from "@/lib/finance/payments/periodLock";
import { monthStart } from "@/lib/finance/period";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 4 — to'lov dvigateli: validate → RBAC → period lock → idempotency → TX (Payment,
// ledger IN, charge'lar, kredit, FIFO) → balans. Double-click, parallel, avans lineage.

const T = (iso: string) => new Date(iso);
const CUTOVER = T("2026-09-30T19:00:00Z");
const SEP = { year: 2026, month: 9 };
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };
const DIRECTOR = { userId: "", role: "DIRECTOR", branchId: null as string | null };

describe("payment engine (Phase 4)", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; group: string; student: string; director: string; manager2: string };

  beforeAll(async () => {
    db = createTestDb("payments");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Filial-2" } });
    const director = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const manager2 = await p.user.create({ data: { fullName: "Menejer-2", email: "m2@t.local", passwordHash: "x", role: "MANAGER", branchId: branch2.id } });
    const prog = await p.program.create({ data: { name: "IELTS", monthlyFee: 1_000_000 } });
    const group = await p.group.create({ data: { name: "IELTS-12", programId: prog.id, branchId: branch.id } });
    const student = await p.student.create({ data: { fullName: "Ali Karimov", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-09-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: group.id, studentId: student.id, joinedAt: T("2026-09-01T05:00:00Z") } });
    ids = { branch: branch.id, branch2: branch2.id, group: group.id, student: student.id, director: director.id, manager2: manager2.id };
    DIRECTOR.userId = director.id;
  });

  afterAll(async () => {
    await db.dispose();
  });

  const pay = (amount: number, receivedAt: string, key: string, extra: Record<string, unknown> = {}, now = T(receivedAt)) =>
    acceptPayment(db.prisma, { studentId: ids.student, amount, method: "CASH", receivedAt: T(receivedAt), purpose: "Kurs to'lovi", idempotencyKey: key, ...extra }, DIRECTOR, now);

  it("kassalar: usul bo'yicha standart kassa filial uchun yaratiladi (idempotent)", async () => {
    const a1 = await accountForMethod(db.prisma, ids.branch, "CASH");
    const a2 = await accountForMethod(db.prisma, ids.branch, "cash");
    expect(a1.id).toBe(a2.id);
    expect(a1.type).toBe("MAIN_CASH");
    expect((await accountForMethod(db.prisma, ids.branch, "HUMO")).type).toBe("TERMINAL");
    expect((await ensureDefaultAccounts(db.prisma, ids.branch)).length).toBe(6);
    await db.prisma.setting.create({ data: { key: "finance.accountMap", value: JSON.stringify({ TRANSFER: "CLICK" }) } });
    expect((await accountForMethod(db.prisma, ids.branch, "TRANSFER")).type).toBe("CLICK");
  });

  it("CASE B — FIFO: sen 1M + okt 1M qarz, 25-okt 1.5M to'lov → sen 1M, okt 500k, qoldiq 500k", async () => {
    const r = await pay(1_500_000, "2026-10-25T05:00:00Z", "key-case-b-0001");
    expect(r.replayed).toBe(false);
    expect(r.payment.receivedAt?.toISOString()).toBe("2026-10-25T05:00:00.000Z");
    expect(r.payment.postedAt).not.toBeNull();
    const byMonth = await Promise.all(r.allocations.map(async (a) => ({ amount: a.amount, m: (await db.prisma.studentCharge.findUniqueOrThrow({ where: { id: a.chargeId } })).serviceMonth })));
    expect(byMonth).toEqual([{ amount: 1_000_000, m: 9 }, { amount: 500_000, m: 10 }]);
    expect(r.balance.debt).toBe(500_000);
    expect(r.balance.credit).toBe(0);
    const ledger = await db.prisma.financialTransaction.findFirstOrThrow({ where: { referenceType: "Payment", referenceId: r.payment.id } });
    expect(ledger.direction).toBe("IN");
    expect(ledger.amount).toBe(1_500_000);
    expect(ledger.occurredAt.getTime()).toBe(T("2026-10-25T05:00:00Z").getTime());
    const sep = await db.prisma.studentCharge.findUniqueOrThrow({ where: { chargeKey: monthlyChargeKey(ids.student, ids.group, SEP) } });
    expect(sep.status).toBe("PAID");
    const audit = await db.prisma.auditLog.findFirst({ where: { entityType: "Payment", entityId: r.payment.id } });
    expect(JSON.parse(audit?.newValue ?? "{}").allocated).toBe(1_500_000);
  });

  it("double-click: bir xil idempotencyKey → mavjud to'lov qaytadi, yangi yozuv yo'q", async () => {
    const before = await db.prisma.payment.count();
    const r = await pay(1_500_000, "2026-10-25T05:00:00Z", "key-case-b-0001");
    expect(r.replayed).toBe(true);
    expect(await db.prisma.payment.count()).toBe(before);
    // Parallel ikki xil kalit — ikkalasi ham yoziladi, lekin charge ortiqcha taqsimlanmaydi
    const [x, y] = await Promise.all([pay(300_000, "2026-10-26T05:00:00Z", "key-parallel-01"), pay(300_000, "2026-10-26T05:00:00Z", "key-parallel-02")]);
    expect(x.replayed || y.replayed).toBe(false);
    const oct = await db.prisma.studentCharge.findUniqueOrThrow({ where: { chargeKey: monthlyChargeKey(ids.student, ids.group, OCT) } });
    const sums = await db.prisma.paymentAllocation.aggregate({ _sum: { amount: true }, where: { chargeId: oct.id, kind: "ALLOCATION" } });
    expect(sums._sum.amount).toBe(1_000_000); // 500k + 300k + 200k — 1M dan oshmaydi
    const bal = await studentBalance(db.prisma, ids.student);
    expect(bal.debt).toBe(0);
    expect(bal.credit).toBe(100_000); // 600k to'lovdan 500k ishlatildi
  });

  it("AVANS: kredit keyingi oy charge'iga MANBA TO'LOV bilan qo'llanadi (lineage), earning sanasi emas", async () => {
    // Noyabr charge'i yaratilganda 100k kredit avtomatik qo'llanadi (CREDIT_APPLY)
    await ensureMonthlyCharges(db.prisma, { studentId: ids.student, upTo: NOV, cutoverAt: CUTOVER, now: T("2026-11-02T05:00:00Z") });
    const applied = await applyStudentCredit(db.prisma, ids.student);
    expect(applied).toHaveLength(1);
    expect(applied[0].source).toBe("CREDIT_APPLY");
    expect(applied[0].amount).toBe(100_000);
    const srcPayment = await db.prisma.payment.findUniqueOrThrow({ where: { id: applied[0].paymentId } });
    expect(srcPayment.receivedAt?.toISOString()).toBe("2026-10-26T05:00:00.000Z"); // manba to'lov sanasi saqlanadi
    const nov = await db.prisma.studentCharge.findUniqueOrThrow({ where: { id: applied[0].chargeId } });
    expect(nov.serviceMonth).toBe(11);
    expect(nov.status).toBe("PARTIALLY_PAID");
    const bal = await studentBalance(db.prisma, ids.student);
    expect(bal.debt).toBe(900_000);
    expect(bal.credit).toBe(0);
  });

  it("validatsiya, RBAC, filial cheklovi, davr qulfi", async () => {
    await expect(pay(0, "2026-11-05T05:00:00Z", "key-zero-amount")).rejects.toThrow();
    await expect(pay(100, "2027-01-01T05:00:00Z", "key-future-date", {}, T("2026-11-05T05:00:00Z"))).rejects.toThrow(/kelajak/);
    await expect(acceptPayment(db.prisma, { studentId: ids.student, amount: 100, method: "CASH", receivedAt: T("2026-11-05T05:00:00Z"), purpose: "x y", idempotencyKey: "key-teacher-forbid" }, { userId: "t", role: "TEACHER", branchId: null }, T("2026-11-05T05:00:00Z"))).rejects.toThrow(FinanceError);
    // MANAGER boshqa filial — forbidden
    await expect(acceptPayment(db.prisma, { studentId: ids.student, amount: 100, method: "CASH", receivedAt: T("2026-11-05T05:00:00Z"), purpose: "x y", idempotencyKey: "key-manager-branch2" }, { userId: ids.manager2, role: "MANAGER", branchId: ids.branch2 }, T("2026-11-05T05:00:00Z"))).rejects.toThrow(/filial/);
    // Davr qulfi: oktabr yopiq → oktabr sanali to'lov rad, noyabr o'tadi
    await closePeriod(db.prisma, { branchId: null, ym: OCT, reason: "Oy yopildi", actorId: ids.director });
    await expect(pay(100_000, "2026-10-28T05:00:00Z", "key-locked-period")).rejects.toThrow(/yopiq/);
    const ok = await pay(100_000, "2026-11-05T05:00:00Z", "key-open-november");
    expect(ok.replayed).toBe(false);
    await reopenPeriod(db.prisma, { branchId: null, ym: OCT, reason: "Tuzatish kerak", actorId: ids.director });
    const late = await pay(50_000, "2026-10-28T05:00:00Z", "key-after-reopen");
    expect(late.replayed).toBe(false);
    expect(await db.prisma.payment.count({ where: { idempotencyKey: "key-locked-period" } })).toBe(0);
  });

  it("acceptPaymentTx: legacy `createdAt` emas — receivedAt alohida saqlanadi", async () => {
    const r = await acceptPaymentTx(db.prisma, { studentId: ids.student, amount: 10_000, method: "CARD", receivedAt: T("2026-11-01T03:00:00Z"), purpose: "Test", idempotencyKey: "key-tx-direct-01" }, DIRECTOR, T("2026-11-10T05:00:00Z"));
    expect(r.payment.receivedAt?.getTime()).toBe(T("2026-11-01T03:00:00Z").getTime());
    expect(r.payment.createdAt.getTime()).not.toBe(r.payment.receivedAt?.getTime());
    expect((await db.prisma.financialAccount.findUniqueOrThrow({ where: { id: r.payment.financialAccountId! } })).type).toBe("TERMINAL");
  });
});

describe("payments backfill + verify (legacy → V2)", () => {
  it("PAID → postedAt/ledger/BACKFILL allocation; REFUNDED → Refund LEGACY; legacy qarz bilan solishtiruv", async () => {
    const db = createTestDb("backfill-payments");
    process.env.DATABASE_URL = db.url;
    const { computeDebts } = await import("@/lib/debt");
    try {
      const p = db.prisma;
      const branch = await p.branch.create({ data: { name: "F" } });
      const prog = await p.program.create({ data: { name: "P", monthlyFee: 500_000 } });
      const g = await p.group.create({ data: { name: "G", programId: prog.id, branchId: branch.id } });
      // s1: iyul–sen a'zo (3 × 500k), 1.2M to'lagan (avg), 50k qo'lda qarz, 100k yechib olgan
      const s1 = await p.student.create({ data: { fullName: "L1", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-07-01T05:00:00Z") } });
      await p.groupStudent.create({ data: { groupId: g.id, studentId: s1.id, joinedAt: T("2026-07-01T05:00:00Z") } });
      await p.payment.create({ data: { studentId: s1.id, amount: 1_200_000, method: "CASH", status: "PAID", isManual: true, createdAt: T("2026-08-05T05:00:00Z") } });
      await p.payment.create({ data: { studentId: s1.id, amount: 50_000, method: "CASH", status: "PENDING", isManual: true, createdAt: T("2026-08-10T05:00:00Z") } });
      await p.payment.create({ data: { studentId: s1.id, amount: 100_000, method: "CASH", status: "REFUNDED", isManual: true, purpose: "Yechib olish", createdAt: T("2026-08-20T05:00:00Z") } });
      await p.payment.create({ data: { studentId: s1.id, amount: 999_999, method: "CASH", status: "CANCELLED", isManual: true, createdAt: T("2026-08-21T05:00:00Z") } });
      // s2: ortiqcha to'lagan (kredit)
      const s2 = await p.student.create({ data: { fullName: "L2", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-09-01T05:00:00Z") } });
      await p.groupStudent.create({ data: { groupId: g.id, studentId: s2.id, joinedAt: T("2026-09-01T05:00:00Z") } });
      await p.payment.create({ data: { studentId: s2.id, amount: 800_000, method: "CLICK", status: "PAID", createdAt: T("2026-09-03T05:00:00Z") } });
      // s3: guruhsiz — legacy standart to'lovni qarz qiladi (3 × 300k), V2 esa yo'q (S2)
      await p.setting.create({ data: { key: "finance.defaultMonthlyFee", value: "300000" } });
      const s3 = await p.student.create({ data: { fullName: "Guruhsiz", eduStatus: "WAITING", createdAt: T("2026-07-01T05:00:00Z") } });

      const now = T("2026-09-25T05:00:00Z");
      const legacy = await computeDebts([s1.id, s2.id, s3.id], now);
      expect(legacy.get(s1.id)?.debt).toBe(350_000); // 1.5M + 50k − 1.2M
      expect(legacy.get(s2.id)?.credit).toBe(300_000);
      expect(legacy.get(s3.id)?.debt).toBe(900_000);

      await backfillBilling(p, { upTo: SEP, cutoverAt: CUTOVER, now });
      const dry = await backfillPayments(p, { dryRun: true, upTo: SEP, cutoverAt: CUTOVER, now });
      expect(dry.paidPosted).toBe(2);
      expect(await p.financialTransaction.count()).toBe(0);
      const r = await backfillPayments(p, { upTo: SEP, cutoverAt: CUTOVER, now });
      expect(r.paidPosted).toBe(2);
      expect(r.paidAmount).toBe(2_000_000);
      expect(r.refundsCreated).toBe(1);
      expect(r.allocationsCreated).toBe(5); // s1: iyul 500k, avg 500k, avg qo'lda qarz 50k, sen 150k; s2: sen 500k
      expect(await p.financialTransaction.count({ where: { direction: "IN" } })).toBe(2);
      expect(await p.financialTransaction.count({ where: { direction: "OUT", type: "REFUND" } })).toBe(1);
      const refund = await p.refund.findFirstOrThrow({ where: { studentId: s1.id } });
      expect(refund.source).toBe("LEGACY");
      expect(refund.originalPaymentId).toBeNull();
      expect(await p.paymentAllocation.count({ where: { source: "BACKFILL" } })).toBe(5);
      expect(await p.teacherEarning.count()).toBe(0); // backfill earning yaratmaydi

      const again = await backfillPayments(p, { upTo: SEP, cutoverAt: CUTOVER, now });
      expect(again.paidPosted).toBe(0);
      expect(again.paidExisting).toBe(2);
      expect(again.refundsExisting).toBe(1);
      expect(again.allocationsCreated).toBe(0);

      const v = await verifyDebt(p, new Map([...legacy.entries()].map(([k, x]) => [k, { debt: x.debt, credit: x.credit }])), now);
      expect(v.paidTotalsMatch).toBe(true);
      expect(v.unexpected).toBe(0);
      expect(v.rows.find((x) => x.studentId === s1.id)).toMatchObject({ legacyDebt: 350_000, v2Debt: 350_000, classification: "EQUAL" });
      expect(v.rows.find((x) => x.studentId === s2.id)).toMatchObject({ legacyCredit: 300_000, v2Credit: 300_000, classification: "EQUAL" });
      expect(v.rows.find((x) => x.studentId === s3.id)).toMatchObject({ legacyDebt: 900_000, v2Debt: 0, classification: "EXPECTED" });
    } finally {
      await db.dispose();
    }
  }, 60_000);

});
