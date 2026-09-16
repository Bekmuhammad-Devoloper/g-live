import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// ═══ FINAL BIZNES QOIDASI — REGRESSION LOCK ═══
// O'qituvchi foizi o'quvchining REAL TO'LOVIGA qarab. Sentabr narxi 1 000 000, o'qituvchi 40%:
//   sentabrda 1M → 400 000; sentabrda 500k → 200 000; qolgan 500k oktabrda → yana 200 000, lekin earningMonth = OKTABR,
//   rate = SENTABR xizmat davridagi 40% (oktabrdan 45% bo'lsa ham). Oktabr xizmati uchun → 45%.
// Bitta to'lov uchun dublikat komissiya yo'q.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const SEP: YearMonth = { year: 2026, month: 9 };
const OCT: YearMonth = { year: 2026, month: 10 };
const FEE = 1_000_000;

describe("salary rate lock (FINAL rule I)", () => {
  let db: TestDb;
  let ids: { branch: string; group: string; teacher: string; director: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = () => `ratelock-${String(++n).padStart(4, "0")}`;
  const pay = (studentId: string, amount: number, at: string) => acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: key() }, director, T(at));
  const earningsOf = (paymentId: string) => db.prisma.teacherEarning.findMany({ where: { sourcePaymentId: paymentId }, orderBy: { createdAt: "asc" } });

  beforeAll(async () => {
    db = createTestDb("rate-lock");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "Nemis A1", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "A1-01", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    await ensureDefaultAccounts(p, branch.id, d.id);
    await assignTeacher(p, { groupId: group.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    // Sentabr: 40%; oktabrdan: 45% (yangi qoida eskisini oktabr boshida yopadi — mutate emas)
    await createSalaryRule(p, { scope: "TEACHER", targetId: t.id, component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await createSalaryRule(p, { scope: "TEACHER", targetId: t.id, component: "PERCENT", rateBp: 4500, effectiveFrom: monthStart(OCT), actorId: d.id });
    ids = { branch: branch.id, group: group.id, teacher: t.id, director: d.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  async function student(name: string) {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId: ids.branch, eduStatus: "ACTIVE", createdAt: monthStart(SEP) } });
    await db.prisma.groupStudent.create({ data: { groupId: ids.group, studentId: s.id, joinedAt: monthStart(SEP) } });
    return s;
  }

  it("sentabrda to'liq 1M → 400 000 (service=Sen, earning=Sen, 40%)", async () => {
    const s = await student("Full");
    const r = await pay(s.id, FEE, "2026-09-10T05:00:00Z");
    const es = await earningsOf(r.payment.id);
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ amount: 400_000, rateBp: 4000, serviceMonth: 9, earningMonth: 9, status: "POSTED" });
  });

  it("sentabrda 500k → 200 000 (earning=Sen); qolgan 500k oktabrda → 200 000, earningMonth=OKT, rate=40% (sentabr qoidasi)", async () => {
    const s = await student("Partial");
    const r1 = await pay(s.id, 500_000, "2026-09-10T05:00:00Z");
    expect((await earningsOf(r1.payment.id))[0]).toMatchObject({ amount: 200_000, rateBp: 4000, serviceMonth: 9, earningMonth: 9 });
    const r2 = await pay(s.id, 500_000, "2026-10-12T05:00:00Z"); // sentabr qarzi FIFO bilan birinchi yopiladi
    const sepCharge = await db.prisma.studentCharge.findFirstOrThrow({ where: { studentId: s.id, serviceMonth: 9 } });
    expect(r2.allocations.map((a) => [a.chargeId, a.amount])).toEqual([[sepCharge.id, 500_000]]);
    const es = await earningsOf(r2.payment.id);
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ amount: 200_000, rateBp: 4000, serviceMonth: 9, earningMonth: 10 });
    expect((await db.prisma.studentCharge.findUniqueOrThrow({ where: { id: sepCharge.id } })).status).toBe("PAID");
    // Sentabr uchun jami komissiya = 400k (ikki qism), dublikat yo'q
    const total = await db.prisma.teacherEarning.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { studentId: s.id, serviceMonth: 9 } });
    expect(total).toMatchObject({ _sum: { amount: 400_000 }, _count: { _all: 2 } });
  });

  it("oktabr xizmati uchun oktabrdagi to'lov → 45% (450 000); sentabr qarzi oktabrda → baribir 40%", async () => {
    const s = await student("Rate");
    const r = await pay(s.id, 2 * FEE, "2026-10-15T05:00:00Z"); // 2M: sentabr (40%) + oktabr (45%)
    const es = await earningsOf(r.payment.id);
    const rows = es.map((e) => [e.serviceMonth, e.earningMonth, e.rateBp, e.amount]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    expect(rows).toEqual([[9, 10, 4000, 400_000], [10, 10, 4500, 450_000]]);
    expect(await db.prisma.teacherEarning.count({ where: { sourcePaymentId: r.payment.id } })).toBe(2); // har allocation uchun bitta
  });
});
