import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { createDiscount } from "@/lib/finance/billing/discounts";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { monthStart, type YearMonth } from "@/lib/finance/period";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryPolicyVersion } from "@/lib/finance/salary/policy";
import { createSalaryRule, endSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Maosh chekka holatlari (J): o'qituvchi almashinuvi oy o'rtasida, qoida muddati tugashi (fallback),
// o'quvchiga xos qoida end-to-end, chegirma + maosh bazasi (REAL_PAID vs FULL_PRICE_EQUIVALENT), attendance NONE.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const OCT: YearMonth = { year: 2026, month: 10 };
const NOV: YearMonth = { year: 2026, month: 11 };
const FEE = 1_000_000;

describe("salary edge cases", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; program: string; director: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = () => `saledge-${String(++n).padStart(4, "0")}`;
  const pay = (studentId: string, amount: number, at: string) => acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: key() }, director, T(at));
  const earningsOf = (paymentId: string) => db.prisma.teacherEarning.findMany({ where: { sourcePaymentId: paymentId }, orderBy: [{ amount: "desc" }] });
  async function mkTeacher(name: string, branchId = ids.branch) {
    return db.prisma.user.create({ data: { fullName: name, email: `${name.toLowerCase()}@t.local`, passwordHash: "x", role: "TEACHER", branchId } });
  }
  async function mkGroup(name: string, teacherId: string, branchId = ids.branch) {
    const g = await db.prisma.group.create({ data: { name, programId: ids.program, branchId, teacherId, createdAt: monthStart(AUG) } });
    await assignTeacher(db.prisma, { groupId: g.id, teacherId, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: ids.director });
    return g;
  }
  async function mkStudent(name: string, groupId: string, branchId = ids.branch) {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId, eduStatus: "ACTIVE", createdAt: monthStart(OCT) } });
    await db.prisma.groupStudent.create({ data: { groupId, studentId: s.id, joinedAt: monthStart(OCT) } });
    return s;
  }

  beforeAll(async () => {
    db = createTestDb("salary-edges");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Chilonzor" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    await ensureDefaultAccounts(p, branch.id, d.id);
    await ensureDefaultAccounts(p, branch2.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    await createSalaryPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, branch2: branch2.id, program: program.id, director: d.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("o'qituvchi almashinuvi oy o'rtasida (15-okt): oktabr to'lovi → ikkala MAIN ham NEEDS_REVIEW (AMBIGUOUS), noyabr → faqat yangi o'qituvchi POSTED", async () => {
    const p = db.prisma;
    const t1 = await mkTeacher("Old"); const t2 = await mkTeacher("New");
    const g = await mkGroup("Swap", t1.id);
    const s = await mkStudent("SwapStudent", g.id);
    await assignTeacher(p, { groupId: g.id, teacherId: t2.id, role: "MAIN", effectiveFrom: T("2026-10-14T19:00:00Z"), actorId: ids.director }); // eski interval shu sanada yopiladi
    const r1 = await pay(s.id, FEE, "2026-10-20T05:00:00Z");
    const es1 = await earningsOf(r1.payment.id);
    expect(es1.map((e) => e.status)).toEqual(["NEEDS_REVIEW", "NEEDS_REVIEW"]);
    expect(es1.every((e) => e.reviewReason === "AMBIGUOUS_ASSIGNMENT")).toBe(true);
    expect(await p.teacherEarning.count({ where: { sourcePaymentId: r1.payment.id, status: "POSTED" } })).toBe(0); // dublikat to'liq komissiya yo'q
    const r2 = await pay(s.id, FEE, "2026-11-10T05:00:00Z");
    const es2 = await earningsOf(r2.payment.id);
    expect(es2).toHaveLength(1);
    expect(es2[0]).toMatchObject({ teacherId: t2.id, status: "POSTED", amount: 400_000, serviceMonth: 11 });
  });

  it("qoida muddati: TEACHER 50% avg–okt, noyabrda tugaydi → noyabr xizmati GLOBAL 40%; oktabr xizmati (noyabrda to'langan) 50%", async () => {
    const p = db.prisma;
    const t = await mkTeacher("Expiring");
    const g = await mkGroup("Exp", t.id);
    const s = await mkStudent("ExpStudent", g.id);
    const rule = await createSalaryRule(p, { scope: "TEACHER", targetId: t.id, component: "PERCENT", rateBp: 5000, effectiveFrom: monthStart(AUG), actorId: ids.director });
    await endSalaryRule(p, rule.id, monthStart(NOV), ids.director, "Muddati tugadi");
    const r = await pay(s.id, 2 * FEE, "2026-11-10T05:00:00Z"); // okt (50%) + noy (40%)
    const es = (await earningsOf(r.payment.id)).sort((a, b) => (a.serviceMonth ?? 0) - (b.serviceMonth ?? 0));
    expect(es.map((e) => [e.serviceMonth, e.rateBp, e.amount])).toEqual([[10, 5000, 500_000], [11, 4000, 400_000]]);
  });

  it("o'quvchiga xos qoida (STUDENT 30%) TEACHER (50%) va GLOBAL dan ustun; kurs qoidasi filial qoidasidan ustun; filial qoidasi global'dan", async () => {
    const p = db.prisma;
    const t = await mkTeacher("Prio", ids.branch2);
    const g = await mkGroup("Prio", t.id, ids.branch2);
    const s = await mkStudent("PrioStudent", g.id, ids.branch2);
    await createSalaryRule(p, { scope: "BRANCH", targetId: ids.branch2, component: "PERCENT", rateBp: 4200, effectiveFrom: monthStart(AUG), actorId: ids.director });
    const r0 = await pay(s.id, 100_000, "2026-10-02T05:00:00Z");
    expect((await earningsOf(r0.payment.id))[0]).toMatchObject({ rateBp: 4200, amount: 42_000 }); // BRANCH > GLOBAL
    await createSalaryRule(p, { scope: "COURSE", targetId: ids.program, component: "PERCENT", rateBp: 4400, effectiveFrom: monthStart(AUG), actorId: ids.director });
    const r1 = await pay(s.id, 100_000, "2026-10-03T05:00:00Z");
    expect((await earningsOf(r1.payment.id))[0]).toMatchObject({ rateBp: 4400, amount: 44_000 }); // COURSE > BRANCH
    await createSalaryRule(p, { scope: "TEACHER", targetId: t.id, component: "PERCENT", rateBp: 5000, effectiveFrom: monthStart(AUG), actorId: ids.director });
    await createSalaryRule(p, { scope: "STUDENT", targetId: s.id, component: "PERCENT", rateBp: 3000, effectiveFrom: monthStart(AUG), actorId: ids.director });
    const r2 = await pay(s.id, 100_000, "2026-10-04T05:00:00Z");
    expect((await earningsOf(r2.payment.id))[0]).toMatchObject({ rateBp: 3000, amount: 30_000 }); // STUDENT > TEACHER
  });

  it("chegirma + maosh bazasi: REAL_PAID (standart) → 800k×44% = 352k; FULL_PRICE_EQUIVALENT siyosati → 1M×44% = 440k; attendance NONE to'liq", async () => {
    const p = db.prisma;
    const t = await mkTeacher("Base");
    const g = await mkGroup("Base", t.id);
    const s = await mkStudent("BaseStudent", g.id);
    await createDiscount(p, { studentId: s.id, type: "PERCENT", value: 2000, effectiveFrom: monthStart(OCT), reason: "20%", actorId: ids.director });
    const r = await pay(s.id, 800_000, "2026-10-05T05:00:00Z");
    // Oldingi testdagi COURSE qoidasi (44%) shu kursga amal qiladi — baza REAL_PAID: 800k × 44% = 352k
    expect((await earningsOf(r.payment.id))[0]).toMatchObject({ baseAmount: 800_000, eligibleAmount: 800_000, rateBp: 4400, amount: 352_000 });
    // Noyabrdan FULL_PRICE_EQUIVALENT (global siyosat v2)
    await createSalaryPolicyVersion(p, { name: "Standart", effectiveFrom: monthStart(NOV), salaryBaseMode: "FULL_PRICE_EQUIVALENT", actorId: ids.director });
    const r2 = await pay(s.id, 800_000, "2026-11-05T05:00:00Z");
    const e2 = (await earningsOf(r2.payment.id))[0];
    expect(e2).toMatchObject({ baseAmount: FEE, rateBp: 4400, amount: 440_000, serviceMonth: 11 }); // to'liq narx ekvivalenti × 44%
    expect(JSON.parse(e2.snapshot).policy.baseMode).toBe("FULL_PRICE_EQUIVALENT");
  });
});
