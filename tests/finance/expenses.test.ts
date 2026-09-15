import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountForMethod } from "@/lib/finance/accounts/accounts";
import { accountBalance } from "@/lib/finance/accounts/balances";
import { FinanceError } from "@/lib/finance/errors";
import { createExpense, normalizeExpenseMethod, reverseExpense } from "@/lib/finance/expenses/expenses";
import { backfillExpenses } from "@/lib/finance/ops/backfill";
import { closePeriod } from "@/lib/finance/payments/periodLock";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 10 — xarajat = ledger OUT; correction = teskari (ledger IN) + yangi; hard delete yo'q;
// MANAGER o'z filiali; period lock; idempotent; legacy backfill.

const T = (iso: string) => new Date(iso);

describe("expense engine (Phase 10)", () => {
  let db: TestDb;
  let ids: { branch: string; branch2: string; director: string; manager: string; category: string };
  let director: { userId: string; role: string; branchId: null };
  let manager: { userId: string; role: string; branchId: string };

  beforeAll(async () => {
    db = createTestDb("expenses");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const branch2 = await p.branch.create({ data: { name: "Filial-2" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const m = await p.user.create({ data: { fullName: "Menejer", email: "m@t.local", passwordHash: "x", role: "MANAGER", branchId: branch.id } });
    const cat = await p.expenseCategory.create({ data: { name: "Ijara" } });
    ids = { branch: branch.id, branch2: branch2.id, director: d.id, manager: m.id, category: cat.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
    manager = { userId: m.id, role: "MANAGER", branchId: branch.id };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("normalizeExpenseMethod: HUMO saqlanadi, noma'lum → CASH + methodRaw", () => {
    expect(normalizeExpenseMethod("humo")).toEqual({ method: "HUMO", methodRaw: "humo" });
    expect(normalizeExpenseMethod("CASH")).toEqual({ method: "CASH", methodRaw: null });
    expect(normalizeExpenseMethod("Naqd")).toEqual({ method: "CASH", methodRaw: "Naqd" });
  });

  it("MANAGER o'z filialiga xarajat: ledger OUT, balans kamayadi; idempotent; boshqa filial kassasi rad", async () => {
    const p = db.prisma;
    const cash = await accountForMethod(p, ids.branch, "CASH");
    await p.financialTransaction.create({ data: { accountId: cash.id, branchId: ids.branch, type: "OPENING_BALANCE", direction: "IN", amount: 5_000_000, referenceType: "FinancialAccount", referenceId: cash.id, occurredAt: T("2026-09-30T19:00:00Z"), idempotencyKey: `FinancialAccount:${cash.id}:IN:0` } });
    const r = await createExpense(p, { name: "Ijara oktabr", amount: 3_000_000, date: T("2026-10-03T05:00:00Z"), method: "cash", categoryId: ids.category, recipient: "Mulkdor", idempotencyKey: "exp-0001", branchId: ids.branch2 }, manager, T("2026-10-03T06:00:00Z"));
    expect(r.replayed).toBe(false);
    expect(r.expense.branchId).toBe(ids.branch); // MANAGER: input branchId e'tiborsiz, o'z filiali
    expect(r.expense.financialAccountId).toBe(cash.id);
    expect(r.expense.status).toBe("ACTIVE");
    expect(r.expense.postedAt).not.toBeNull();
    const led = await p.financialTransaction.findFirstOrThrow({ where: { referenceType: "Expense", referenceId: r.expense.id } });
    expect(led).toMatchObject({ type: "EXPENSE", direction: "OUT", amount: 3_000_000, occurredAt: T("2026-10-03T05:00:00Z") });
    expect(await accountBalance(p, cash.id)).toBe(2_000_000);
    expect((await createExpense(p, { name: "Ijara oktabr", amount: 3_000_000, date: T("2026-10-03T05:00:00Z"), method: "cash", idempotencyKey: "exp-0001" }, manager, T("2026-10-03T06:00:00Z"))).replayed).toBe(true);
    expect(await p.expense.count()).toBe(1);
    const other = await accountForMethod(p, ids.branch2, "CASH");
    await expect(createExpense(p, { name: "Boshqa filial", amount: 1, date: T("2026-10-03T05:00:00Z"), method: "CASH", financialAccountId: other.id, idempotencyKey: "exp-other-branch" }, manager, T("2026-10-03T06:00:00Z"))).rejects.toThrow(/filial/);
    await expect(createExpense(p, { name: "Ruxsatsiz", amount: 1, date: T("2026-10-03T05:00:00Z"), method: "CASH", idempotencyKey: "exp-teacher" }, { userId: "t", role: "TEACHER", branchId: null }, T("2026-10-03T06:00:00Z"))).rejects.toThrow(FinanceError);
  });

  it("correction: reverseExpense → teskari qator (ledger IN), asl REVERSED, yangi to'g'ri xarajat; hard delete yo'q; period lock", async () => {
    const p = db.prisma;
    const orig = await p.expense.findFirstOrThrow({ where: { idempotencyKey: "exp-0001" } });
    await expect(reverseExpense(p, { expenseId: orig.id, reason: "x", idempotencyKey: "exp-rev-short" }, director)).rejects.toThrow(/Sabab/);
    await expect(reverseExpense(p, { expenseId: orig.id, reason: "Summa xato", idempotencyKey: "exp-rev-mgr" }, manager)).rejects.toThrow(FinanceError); // EXPENSE_CORRECT yo'q
    const r = await reverseExpense(p, { expenseId: orig.id, reason: "Summa xato: 2.5M edi", idempotencyKey: "exp-rev-0001", replacement: { name: "Ijara oktabr (tuzatilgan)", amount: 2_500_000, date: T("2026-10-03T05:00:00Z"), method: "CASH", categoryId: ids.category } }, director, T("2026-10-04T05:00:00Z"));
    expect(r.original.status).toBe("REVERSED");
    expect(r.reversal.reversalOfId).toBe(orig.id);
    expect(r.replacement?.amount).toBe(2_500_000);
    const cash = await accountForMethod(p, ids.branch, "CASH");
    expect(await accountBalance(p, cash.id)).toBe(2_500_000); // 5M − 3M + 3M − 2.5M
    const ledgerIn = await p.financialTransaction.findFirstOrThrow({ where: { referenceType: "Expense", referenceId: r.reversal.id } });
    expect(ledgerIn).toMatchObject({ type: "EXPENSE", direction: "IN", amount: 3_000_000 });
    expect(await p.expense.count()).toBe(3); // asl + teskari + yangi — hech biri o'chirilmagan
    await expect(reverseExpense(p, { expenseId: orig.id, reason: "yana", idempotencyKey: "exp-rev-0002" }, director)).rejects.toThrow(/allaqachon/);
    // Davr qulfi
    await closePeriod(p, { branchId: null, ym: { year: 2026, month: 11 }, reason: "Yopiq", actorId: ids.director });
    await expect(createExpense(p, { name: "Noyabr", amount: 1, date: T("2026-11-03T05:00:00Z"), method: "CASH", idempotencyKey: "exp-locked" }, director, T("2026-11-03T06:00:00Z"))).rejects.toThrow(/yopiq/);
  });

  it("backfill: legacy xarajat → kassa + postedAt + ledger OUT (dry-run yozmaydi, idempotent)", async () => {
    const p = db.prisma;
    const legacy = await p.expense.create({ data: { name: "Eski", date: T("2026-09-10T05:00:00Z"), amount: 400_000, method: "Humo", branchId: ids.branch } });
    const dry = await backfillExpenses(p, { dryRun: true });
    expect(dry).toMatchObject({ posted: 1, existing: 3 });
    expect((await p.expense.findUniqueOrThrow({ where: { id: legacy.id } })).postedAt).toBeNull();
    const r = await backfillExpenses(p);
    expect(r).toMatchObject({ posted: 1, existing: 3, amount: 400_000 });
    const row = await p.expense.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(row.method).toBe("HUMO");
    expect(row.methodRaw).toBe("Humo");
    expect(row.postedAt).not.toBeNull();
    const term = await accountForMethod(p, ids.branch, "HUMO");
    expect(row.financialAccountId).toBe(term.id);
    expect(await accountBalance(p, term.id)).toBe(-400_000); // terminal kassasida kirim yo'q edi — legacy ma'lumot
    expect((await backfillExpenses(p)).posted).toBe(0);
  });
});
