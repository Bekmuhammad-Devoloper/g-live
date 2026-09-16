import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDefaultAccounts } from "@/lib/finance/accounts/accounts";
import { studentBalance } from "@/lib/finance/billing/balance";
import { cancelCharge, ensureMonthlyCharges } from "@/lib/finance/billing/charges";
import { createDiscount, endDiscount } from "@/lib/finance/billing/discounts";
import { syncStudentBilling } from "@/lib/finance/billing/sync";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { closePeriod } from "@/lib/finance/payments/periodLock";
import { monthStart, tashkentYearMonth, type YearMonth } from "@/lib/finance/period";
import { createRefund } from "@/lib/finance/refunds/refund";
import { assignTeacher } from "@/lib/finance/salary/assignments";
import { createSalaryRule } from "@/lib/finance/salary/rules";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// To'lov / billing / qaytarim chekka holatlari (G, H, K): validatsiya, guruhsiz/arxiv o'quvchi, guruh almashtirish,
// bir to'lov → ko'p charge, oy/yil chegarasi (Tashkent), chegirma o'zgarishi eski charge'ni o'zgartirmaydi,
// bekor qilingan charge qayta yaratilmaydi, kreditdan qaytarim, ko'p taqsimotli qaytarim.

const T = (iso: string) => new Date(iso);
const AUG: YearMonth = { year: 2026, month: 8 };
const SEP: YearMonth = { year: 2026, month: 9 };
const OCT: YearMonth = { year: 2026, month: 10 };
const NOV: YearMonth = { year: 2026, month: 11 };
const DEC: YearMonth = { year: 2026, month: 12 };
const JAN27: YearMonth = { year: 2027, month: 1 };
const FEE = 1_000_000;

describe("engine edge cases", () => {
  let db: TestDb;
  let ids: { branch: string; program: string; group: string; group2: string; teacher: string; director: string };
  let director: { userId: string; role: string; branchId: null };
  let n = 0;
  const key = (s: string) => `edge-${s}-${String(++n).padStart(4, "0")}`;
  const pay = (studentId: string, amount: number, at: string, k = key("pay"), now?: string) =>
    acceptPayment(db.prisma, { studentId, amount, method: "CASH", receivedAt: T(at), purpose: "Kurs", idempotencyKey: k }, director, T(now ?? at));
  async function mkStudent(name: string, joinedAt: Date | null = monthStart(OCT), groupId = ids.group, eduStatus = "ACTIVE") {
    const s = await db.prisma.student.create({ data: { fullName: name, branchId: ids.branch, eduStatus, createdAt: joinedAt ?? monthStart(OCT) } });
    if (joinedAt) await db.prisma.groupStudent.create({ data: { groupId, studentId: s.id, joinedAt } });
    return s;
  }

  beforeAll(async () => {
    db = createTestDb("edges");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const t = await p.user.create({ data: { fullName: "Akmal", email: "t@t.local", passwordHash: "x", role: "TEACHER", branchId: branch.id } });
    const program = await p.program.create({ data: { name: "P", monthlyFee: FEE } });
    const group = await p.group.create({ data: { name: "G1", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    const group2 = await p.group.create({ data: { name: "G2", programId: program.id, branchId: branch.id, teacherId: t.id, createdAt: monthStart(AUG) } });
    await ensureDefaultAccounts(p, branch.id, d.id);
    await createSalaryRule(p, { scope: "GLOBAL", component: "PERCENT", rateBp: 4000, effectiveFrom: monthStart(AUG), actorId: d.id });
    for (const g of [group, group2]) await assignTeacher(p, { groupId: g.id, teacherId: t.id, role: "MAIN", effectiveFrom: monthStart(AUG), actorId: d.id });
    ids = { branch: branch.id, program: program.id, group: group.id, group2: group2.id, teacher: t.id, director: d.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("validatsiya: 0 va manfiy summa, kelajakdagi sana, noma'lum o'quvchi → rad; hech narsa yozilmaydi", async () => {
    const s = await mkStudent("V");
    const before = await db.prisma.payment.count();
    await expect(pay(s.id, 0, "2026-10-05T05:00:00Z")).rejects.toThrow();
    await expect(pay(s.id, -100, "2026-10-05T05:00:00Z")).rejects.toThrow();
    await expect(pay(s.id, 1.5 as number, "2026-10-05T05:00:00Z")).rejects.toThrow();
    await expect(pay(s.id, FEE, "2026-10-09T05:00:00Z", key("future"), "2026-10-05T05:00:00Z")).rejects.toThrow(/kelajak/);
    await expect(pay("yoq-student", FEE, "2026-10-05T05:00:00Z")).rejects.toThrow();
    expect(await db.prisma.payment.count()).toBe(before);
    // Tarixiy sana (o'tgan oy, qulf yo'q) — qabul qilinadi, earningMonth = qabul oyi
    const r = await pay(s.id, FEE, "2026-09-20T05:00:00Z", key("hist"), "2026-10-05T05:00:00Z");
    expect(tashkentYearMonth(r.payment.receivedAt!)).toEqual(SEP);
  });

  it("guruhsiz o'quvchi → charge yo'q, to'lov kredit; arxivlangan o'quvchi ochiq qarzini to'laydi (yangi charge yo'q)", async () => {
    const p = db.prisma;
    const noGroup = await mkStudent("NoGroup", null);
    const r = await pay(noGroup.id, 300_000, "2026-10-05T05:00:00Z");
    expect(r.allocations).toHaveLength(0);
    expect(r.balance).toMatchObject({ debt: 0, credit: 300_000 });
    // Arxiv: oktabr a'zoligi tugagan (leftAt), oktabr charge ochiq → to'lov qarzni yopadi, noyabr charge yaratilmaydi
    const arch = await mkStudent("Arch", monthStart(OCT));
    await ensureMonthlyCharges(p, { studentId: arch.id, upTo: OCT, now: T("2026-10-02T05:00:00Z") });
    await p.groupStudent.updateMany({ where: { studentId: arch.id }, data: { isActive: false, leftAt: T("2026-10-31T18:59:59Z") } });
    await p.student.update({ where: { id: arch.id }, data: { eduStatus: "ARCHIVED" } });
    const r2 = await pay(arch.id, FEE, "2026-11-10T05:00:00Z");
    expect(r2.allocations.map((a) => a.amount)).toEqual([FEE]);
    expect(await p.studentCharge.count({ where: { studentId: arch.id, serviceMonth: 11 } })).toBe(0);
    expect(r2.balance).toMatchObject({ debt: 0, credit: 0 });
  });

  it("bir to'lov → ko'p charge (2M: sen+okt), keyingi to'lov → bitta charge; guruh almashtirish oy o'rtasida → ikki charge (FULL_MONTH, aniq) va bekor qilish yo'li", async () => {
    const p = db.prisma;
    const s = await mkStudent("Multi", monthStart(SEP));
    const r = await pay(s.id, 2 * FEE, "2026-10-05T05:00:00Z");
    expect(r.allocations.map((a) => a.amount)).toEqual([FEE, FEE]);
    expect((await studentBalance(p, s.id)).debt).toBe(0);
    // Guruh almashtirish: G1 dan 15-noyabr chiqdi, G2 ga 15-noyabr kirdi → noyabr uchun ikkala guruh charge'i (FULL_MONTH siyosati)
    await p.groupStudent.updateMany({ where: { studentId: s.id, groupId: ids.group }, data: { isActive: false, leftAt: T("2026-11-14T19:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: ids.group2, studentId: s.id, joinedAt: T("2026-11-14T19:00:00Z") } });
    const sync = await syncStudentBilling(p, { studentId: s.id, upTo: NOV, actorId: ids.director, now: T("2026-11-20T05:00:00Z") });
    const nov = sync.created.filter((c) => c.serviceMonth === 11);
    expect(nov.map((c) => c.groupId).sort()).toEqual([ids.group, ids.group2].sort()); // ikki to'liq charge — hujjatlashtirilgan xatti-harakat
    // Buxgalter dublikatni aniq, auditli bekor qiladi (taqsimotsiz)
    const dup = nov.find((c) => c.groupId === ids.group)!;
    await cancelCharge(p, dup.id, "Guruh almashtirildi — noyabr faqat G2 da hisoblanadi", ids.director);
    expect((await studentBalance(p, s.id)).debt).toBe(FEE);
    // Qayta sync bekor qilingan charge'ni qayta yaratmaydi (chargeKey mavjud)
    const again = await syncStudentBilling(p, { studentId: s.id, upTo: NOV, actorId: ids.director, now: T("2026-11-21T05:00:00Z") });
    expect(again.created).toHaveLength(0);
    expect(await p.studentCharge.count({ where: { studentId: s.id, serviceMonth: 11 } })).toBe(2);
  });

  it("oy/yil chegarasi (Tashkent): 31-dek 19:30Z = 1-yan 00:30 Toshkent → earningMonth 2027-01; dekabr charge dekabrda", async () => {
    const p = db.prisma;
    const s = await mkStudent("Year", monthStart(DEC));
    const r = await pay(s.id, FEE, "2026-12-31T19:30:00Z");
    expect(tashkentYearMonth(r.payment.receivedAt!)).toEqual(JAN27);
    const es = await p.teacherEarning.findMany({ where: { sourcePaymentId: r.payment.id } });
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ serviceYear: 2026, serviceMonth: 12, earningYear: 2027, earningMonth: 1 });
    const charges = await p.studentCharge.findMany({ where: { studentId: s.id }, orderBy: [{ serviceYear: "asc" }, { serviceMonth: "asc" }] });
    expect(charges.map((c) => [c.serviceYear, c.serviceMonth])).toEqual([[2026, 12], [2027, 1]]);
    expect(r.allocations.map((a) => a.chargeId)).toEqual([charges[0].id]); // FIFO: dekabr birinchi
  });

  it("chegirma o'zgarishi eski charge'ni o'zgartirmaydi; keyingi oy yangi chegirma bilan", async () => {
    const p = db.prisma;
    const s = await mkStudent("Disc", monthStart(OCT));
    const d = await createDiscount(p, { studentId: s.id, type: "PERCENT", value: 2000, effectiveFrom: monthStart(OCT), reason: "20%", actorId: ids.director });
    const oct = (await ensureMonthlyCharges(p, { studentId: s.id, upTo: OCT, now: T("2026-10-02T05:00:00Z") })).created[0];
    expect(oct).toMatchObject({ discountAmount: 200_000, finalAmount: 800_000 });
    await endDiscount(p, d.id, monthStart(NOV), ids.director, "Tugadi");
    await createDiscount(p, { studentId: s.id, type: "FIXED", value: 100_000, effectiveFrom: monthStart(NOV), reason: "100k", actorId: ids.director });
    const nov = (await ensureMonthlyCharges(p, { studentId: s.id, upTo: NOV, now: T("2026-11-02T05:00:00Z") })).created[0];
    expect(nov).toMatchObject({ discountAmount: 100_000, finalAmount: 900_000 });
    expect((await p.studentCharge.findUniqueOrThrow({ where: { id: oct.id } })).finalAmount).toBe(800_000); // o'zgarmadi
  });

  it("kreditdan qaytarim (taqsimot teskarisiz); ko'p taqsimotli qaytarim LIFO (okt → sen), tuzatishlar proporsional", async () => {
    const p = db.prisma;
    const s = await mkStudent("RefCredit", monthStart(OCT));
    const r = await pay(s.id, 1_300_000, "2026-10-05T05:00:00Z"); // 1M okt + 300k kredit
    const ref = await createRefund(p, { paymentId: r.payment.id, amount: 200_000, reason: "Kreditdan", refundedAt: T("2026-10-06T05:00:00Z"), idempotencyKey: key("ref") }, director, T("2026-10-06T05:00:00Z"));
    expect(ref.reversals).toHaveLength(0);
    expect(ref.adjustments).toHaveLength(0);
    expect((await studentBalance(p, s.id))).toMatchObject({ debt: 0, credit: 100_000 });
    const s2 = await mkStudent("RefMulti", monthStart(SEP));
    const r2 = await pay(s2.id, 2 * FEE, "2026-10-05T05:00:00Z"); // sen + okt
    const ref2 = await createRefund(p, { paymentId: r2.payment.id, amount: 1_500_000, reason: "Ko'p taqsimot", refundedAt: T("2026-10-07T05:00:00Z"), idempotencyKey: key("ref2") }, director, T("2026-10-07T05:00:00Z"));
    const octCharge = await p.studentCharge.findFirstOrThrow({ where: { studentId: s2.id, serviceMonth: 10 } });
    const sepCharge = await p.studentCharge.findFirstOrThrow({ where: { studentId: s2.id, serviceMonth: 9 } });
    expect(ref2.reversals.map((x) => [x.chargeId, x.amount])).toEqual([[octCharge.id, FEE], [sepCharge.id, 500_000]]); // LIFO: eng yangi (okt) birinchi
    expect(ref2.adjustments.map((a) => a.amount).sort((a, b) => a - b)).toEqual([-400_000, -200_000]);
    expect((await studentBalance(p, s2.id)).debt).toBe(1_500_000);
    // Yopiq davrga qaytarim rad
    await closePeriod(p, { branchId: null, ym: SEP, reason: "Sentabr yopiq", actorId: ids.director });
    await expect(createRefund(p, { paymentId: r2.payment.id, amount: 100_000, reason: "Yopiq oyga", refundedAt: T("2026-09-25T05:00:00Z"), idempotencyKey: key("ref3") }, director, T("2026-10-08T05:00:00Z"))).rejects.toThrow(/yopiq/);
  });
});
