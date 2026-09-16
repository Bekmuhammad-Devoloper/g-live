import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { accountBalance } from "@/lib/finance/accounts/balances";
import { createTransfer } from "@/lib/finance/accounts/transfers";
import { paymentAvailability, studentBalance } from "@/lib/finance/billing/balance";
import { applyRateBp } from "@/lib/finance/money";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// PROPERTY / FUZZ — seed'li tasodifiy ketma-ketliklar: taqsimot, qaytarim, foiz, ledger balansi invariantlari
// har qadamdan keyin bajarilishi shart (deterministik seed — takrorlanadigan).

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const FEE = 1_000_000;

/** Mulberry32 — kichik deterministik PRNG */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SEED = 20260917;

describe("property-style invariants", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; director: string; accounts: string[] };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `prop-${s}-${String(++n).padStart(5, "0")}`;

  beforeAll(async () => {
    db = createTestDb("property");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "G", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 3700, effectiveFrom: monthStart(AUG), actorId: d.id });
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, group: group.id, teacher: t.id, director: d.id, accounts: accounts.map((a) => a.id) };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("applyRateBp: 0 ≤ natija ≤ baza; monoton; qismlar yig'indisi butundan oshmaydi (yaxlitlash)", () => {
    const r = rng(SEED);
    for (let i = 0; i < 2000; i++) {
      const base = Math.floor(r() * 5_000_000);
      const bp = Math.floor(r() * 10_001);
      const v = applyRateBp(base, bp);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(base);
      expect(Number.isInteger(v)).toBe(true);
      const parts = [Math.floor(base * 0.3), Math.floor(base * 0.3)]; parts.push(base - parts[0] - parts[1]);
      expect(parts.reduce((a, x) => a + applyRateBp(x, bp), 0)).toBeLessThanOrEqual(v + parts.length); // har qismda ≤ 1 so'm yaxlitlash
    }
  });

  it("tasodifiy to'lov/qaytarim ketma-ketligi: taqsimot ≤ to'lov, charge ortiqcha to'lanmaydi, qaytarim ≤ to'lov, net balans = Σto'lov − Σqaytarim − Σyakuniy", async () => {
    const p = db.prisma;
    const r = rng(SEED + 1);
    const s = await p.student.create({ data: { fullName: "Fuzz", branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(AUG) } });
    await p.groupStudent.create({ data: { groupId: ids.group, studentId: s.id, joinedAt: monthStart(AUG) } });
    const paymentIds: string[] = [];
    let day = 1;
    for (let step = 0; step < 40; step++) {
      const month = 8 + Math.floor(step / 10); // avg → noy (4 oy)
      const at = `2026-${String(month).padStart(2, "0")}-${String(1 + (day++ % 27)).padStart(2, "0")}T06:00:00Z`;
      if (r() < 0.7 || paymentIds.length === 0) {
        const amount = 10_000 + Math.floor(r() * 3_000_000);
        const res = await acceptPayment(p, { studentId: s.id, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: key("pay") }, director, T(at));
        paymentIds.push(res.payment.id);
      } else {
        const pid = paymentIds[Math.floor(r() * paymentIds.length)];
        const avail = (await paymentAvailability(p, [pid])).get(pid)!;
        const room = avail.amount - avail.refunded;
        if (room > 0) {
          const amount = 1 + Math.floor(r() * room);
          await createRefund(p, { paymentId: pid, amount, reason: "Fuzz qaytarim", refundedAt: T(at), idempotencyKey: key("ref") }, director, T(at));
        }
      }
      // Invariantlar (har qadamdan keyin)
      const avail = await paymentAvailability(p, paymentIds);
      for (const a of avail.values()) {
        expect(a.allocated - a.reversed).toBeLessThanOrEqual(a.amount);
        expect(a.refunded).toBeLessThanOrEqual(a.amount);
        expect(a.unallocated).toBeGreaterThanOrEqual(0);
      }
      const charges = await p.studentCharge.findMany({ where: { studentId: s.id } });
      for (const c of charges) {
        const agg = await p.paymentAllocation.groupBy({ by: ["kind"], where: { chargeId: c.id }, _sum: { amount: true } });
        const net = (agg.find((x) => x.kind === "ALLOCATION")?._sum.amount ?? 0) - (agg.find((x) => x.kind === "REVERSAL")?._sum.amount ?? 0);
        expect(net).toBeGreaterThanOrEqual(0);
        expect(net).toBeLessThanOrEqual(c.finalAmount);
      }
    }
    const bal = await studentBalance(p, s.id);
    const paid = (await p.payment.aggregate({ _sum: { amount: true }, where: { studentId: s.id } }))._sum.amount ?? 0;
    const refunded = (await p.refund.aggregate({ _sum: { amount: true }, where: { studentId: s.id, status: "DONE" } }))._sum.amount ?? 0;
    const finals = (await p.studentCharge.aggregate({ _sum: { finalAmount: true }, where: { studentId: s.id, status: { not: "CANCELLED" } } }))._sum.finalAmount ?? 0;
    expect(bal.credit - bal.debt).toBe(paid - refunded - finals);
    // Ledger: to'lovlar IN, qaytarimlar OUT — kassa balansi = Σto'lov − Σqaytarim
    const cashIn = (await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { direction: "IN", type: "STUDENT_PAYMENT" } }))._sum.amount ?? 0;
    const cashOut = (await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { direction: "OUT", type: "REFUND" } }))._sum.amount ?? 0;
    expect(cashIn).toBe(paid);
    expect(cashOut).toBe(refunded);
    // Earning'lar: har POSTED komissiya ≤ allocation × 37%; tuzatishlar asl earning'dan oshmaydi
    const earnings = await p.teacherEarning.findMany({ where: { studentId: s.id } });
    for (const e of earnings.filter((x) => x.type === "PAYMENT_COMMISSION")) {
      expect(e.amount).toBe(applyRateBp(e.eligibleAmount, 3700));
      const adj = earnings.filter((x) => x.reversalOfId === e.id).reduce((a, x) => a + x.amount, 0);
      expect(-adj).toBeLessThanOrEqual(e.amount);
    }
  });

  it("tasodifiy transferlar: kassalar yig'indisi o'zgarmaydi, hech bir kassa manfiy bo'lmaydi (allowNegative'siz), har transfer 2 ledger", async () => {
    const p = db.prisma;
    const r = rng(SEED + 2);
    const accs = ids.accounts;
    const total0 = (await Promise.all(accs.map((a) => accountBalance(p, a)))).reduce((a, b) => a + b, 0);
    let ok = 0, rejected = 0;
    for (let i = 0; i < 30; i++) {
      const from = accs[Math.floor(r() * accs.length)];
      let to = accs[Math.floor(r() * accs.length)];
      if (to === from) to = accs[(accs.indexOf(from) + 1) % accs.length];
      const amount = 1_000 + Math.floor(r() * 2_000_000);
      const at = `2026-11-${String(1 + (i % 27)).padStart(2, "0")}T06:00:00Z`;
      try {
        const res = await createTransfer(p, { fromAccountId: from, toAccountId: to, amount, occurredAt: T(at), idempotencyKey: key("tr") }, director, T(at));
        ok++;
        expect(await p.financialTransaction.count({ where: { referenceType: "Transfer", referenceId: res.transfer.id } })).toBe(2);
      } catch { rejected++; }
      for (const a of accs) expect(await accountBalance(p, a)).toBeGreaterThanOrEqual(0);
    }
    expect(ok + rejected).toBe(30);
    const total1 = (await Promise.all(accs.map((a) => accountBalance(p, a)))).reduce((a, b) => a + b, 0);
    expect(total1).toBe(total0);
    const inn = (await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { type: "TRANSFER_IN" } }))._sum.amount ?? 0;
    const out = (await p.financialTransaction.aggregate({ _sum: { amount: true }, where: { type: "TRANSFER_OUT" } }))._sum.amount ?? 0;
    expect(inn).toBe(out);
  });
});
