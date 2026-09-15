import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// B1 — moliyaviy tarixi bor obyekt o'chirilmaydi: guard (UX) + baza Restrict (asosiy).
// guards.ts loyihaning `@/lib/db` singleton'ini ishlatadi — DATABASE_URL shu test
// bazasiga yo'naltirilib, modul dinamik import qilinadi.

describe("finance guards (B1)", () => {
  let db: TestDb;
  let guards: typeof import("@/lib/finance/guards");
  let ids: { student: string; group: string; program: string; branch: string; teacher: string; clean: string };

  beforeAll(async () => {
    db = createTestDb("guards");
    process.env.DATABASE_URL = db.url;
    guards = await import("@/lib/finance/guards");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Filial" } });
    const teacher = await p.user.create({ data: { fullName: "Ustoz", email: "ustoz@t.local", passwordHash: "x", role: "TEACHER" } });
    const program = await p.program.create({ data: { name: "Nemis" } });
    const group = await p.group.create({ data: { name: "A1-1", programId: program.id, branchId: branch.id, teacherId: teacher.id } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id } });
    const clean = await p.student.create({ data: { fullName: "Toza" } });
    await p.studentCharge.create({ data: { studentId: student.id, groupId: group.id, programId: program.id, branchId: branch.id, kind: "MONTHLY", serviceYear: 2026, serviceMonth: 10, originalAmount: 1, finalAmount: 1, dueDate: new Date(), chargeKey: "k1" } });
    await p.groupTeacherAssignment.create({ data: { groupId: group.id, teacherId: teacher.id, effectiveFrom: new Date() } });
    ids = { student: student.id, group: group.id, program: program.id, branch: branch.id, teacher: teacher.id, clean: clean.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("tarixi bor obyektlar aniqlanadi, toza obyekt — yo'q", async () => {
    expect((await guards.financeHistoryOf("student", ids.student)).breakdown).toEqual({ StudentCharge: 1 });
    expect(await guards.hasFinanceHistory("group", ids.group)).toBe(true);
    expect(await guards.hasFinanceHistory("program", ids.program)).toBe(true);
    expect(await guards.hasFinanceHistory("branch", ids.branch)).toBe(true);
    expect(await guards.hasFinanceHistory("user", ids.teacher)).toBe(true);
    expect(await guards.hasFinanceHistory("student", ids.clean)).toBe(false);
  });

  it("P2003 (Restrict) tanib olinadi — poyga bo'lsa ham baza himoya qiladi", async () => {
    let caught: unknown;
    try {
      await db.prisma.student.delete({ where: { id: ids.student } });
    } catch (e) {
      caught = e;
    }
    expect(guards.isRestrictError(caught)).toBe(true);
    expect(guards.isRestrictError(new Error("x"))).toBe(false);
  });

  it("xabar 4 tilda, kod barqaror", () => {
    expect(guards.FINANCE_HISTORY_ERROR).toBe("has-finance-history");
    expect(guards.financeHistoryMessage("uz")).toContain("Arxivlang");
    expect(guards.financeHistoryMessage("ru")).toContain("Заархивируйте");
  });
});
