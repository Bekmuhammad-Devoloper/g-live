import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAccount, ensureDefaultAccounts, updateAccount } from "@/lib/finance/accounts/accounts";
import { accountBalance, accountStatement, accountsOverview } from "@/lib/finance/accounts/balances";
import { createTransfer, reverseTransfer } from "@/lib/finance/accounts/transfers";
import { FinanceError } from "@/lib/finance/errors";
import { acceptPayment } from "@/lib/finance/payments/accept";
import { createTestDb, type TestDb } from "../setup/prismaTestDb";

// Phase 9 — kassalar: ochilish balansi ledger qatori, balans = Σ IN − Σ OUT, ko'chirma,
// transfer (2 ledger qator, xarajat emas), teskari transfer, opening o'zgarmasligi.

const T = (iso: string) => new Date(iso);

describe("financial accounts / cashbox (Phase 9)", () => {
  let db: TestDb;
  let ids: { branch: string; student: string; director: string; cash: string; bank: string };
  let director: { userId: string; role: string; branchId: null };

  beforeAll(async () => {
    db = createTestDb("accounts");
    const p = db.prisma;
    const branch = await p.branch.create({ data: { name: "Markaz" } });
    const d = await p.user.create({ data: { fullName: "Direktor", email: "d@t.local", passwordHash: "x", role: "DIRECTOR" } });
    const prog = await p.program.create({ data: { name: "P", monthlyFee: 700_000 } });
    const g = await p.group.create({ data: { name: "G", programId: prog.id, branchId: branch.id } });
    const student = await p.student.create({ data: { fullName: "Ali", branchId: branch.id, eduStatus: "ACTIVE", createdAt: T("2026-10-01T05:00:00Z") } });
    await p.groupStudent.create({ data: { groupId: g.id, studentId: student.id, joinedAt: T("2026-10-01T05:00:00Z") } });
    const accounts = await ensureDefaultAccounts(p, branch.id, d.id);
    ids = { branch: branch.id, student: student.id, director: d.id, cash: accounts.find((a) => a.type === "MAIN_CASH")!.id, bank: accounts.find((a) => a.type === "BANK")!.id };
    director = { userId: d.id, role: "DIRECTOR", branchId: null };
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("ochilish balansi = ledger OPENING_BALANCE qatori; balans ledgerdan; updateAccount opening'ni o'zgartirmaydi", async () => {
    const p = db.prisma;
    const acc = await createAccount(p, { branchId: ids.branch, name: "Seyf", type: "CUSTOM", openingBalance: 5_000_000, openingAt: T("2026-09-30T19:00:00Z"), actorId: ids.director });
    const opening = await p.financialTransaction.findFirstOrThrow({ where: { referenceType: "FinancialAccount", referenceId: acc.id } });
    expect(opening).toMatchObject({ type: "OPENING_BALANCE", direction: "IN", amount: 5_000_000 });
    expect(await accountBalance(p, acc.id)).toBe(5_000_000);
    expect(await accountBalance(p, acc.id, T("2026-09-01T00:00:00Z"))).toBe(0); // ochilishdan oldin 0
    const upd = await updateAccount(p, { id: acc.id, name: "Seyf (asosiy)", note: "izoh" });
    expect(upd.openingBalance).toBe(5_000_000);
    await expect(createAccount(p, { name: "x", type: "MAIN_CASH" })).rejects.toThrow(FinanceError);
  });

  it("to'lov kassaga IN; ko'chirma (opening/inflow/outflow/closing, running)", async () => {
    const p = db.prisma;
    await acceptPayment(p, { studentId: ids.student, amount: 700_000, method: "CASH", receivedAt: T("2026-10-05T05:00:00Z"), purpose: "Kurs", idempotencyKey: "acc-pay-0001" }, director, T("2026-10-05T05:00:00Z"));
    await acceptPayment(p, { studentId: ids.student, amount: 300_000, method: "CASH", receivedAt: T("2026-11-03T05:00:00Z"), purpose: "Kurs", idempotencyKey: "acc-pay-0002" }, director, T("2026-11-03T05:00:00Z"));
    expect(await accountBalance(p, ids.cash)).toBe(1_000_000);
    const st = await accountStatement(p, ids.cash, T("2026-10-31T19:00:00Z"), T("2026-11-30T19:00:00Z")); // noyabr (Tashkent)
    expect(st).toMatchObject({ opening: 700_000, inflow: 300_000, outflow: 0, closing: 1_000_000 });
    expect(st.lines.map((l) => l.running)).toEqual([1_000_000]);
    const overview = await accountsOverview(p, { branchId: ids.branch });
    expect(overview.find((o) => o.account.id === ids.cash)?.balance).toBe(1_000_000);
    expect(overview.length).toBe(7); // 6 standart + Seyf
  });

  it("transfer: kassa → bank 400k = 2 ledger qator (OUT, IN), xarajat emas; yetarli emas → rad; teskari transfer", async () => {
    const p = db.prisma;
    const r = await createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 400_000, occurredAt: T("2026-11-05T05:00:00Z"), note: "Bankka", idempotencyKey: "acc-tr-0001" }, director, T("2026-11-05T05:00:00Z"));
    expect(r.replayed).toBe(false);
    const rows = await p.financialTransaction.findMany({ where: { referenceType: "Transfer", referenceId: r.transfer.id }, orderBy: { direction: "asc" } });
    expect(rows.map((x) => [x.accountId === ids.cash ? "cash" : "bank", x.type, x.direction, x.amount])).toEqual([["bank", "TRANSFER_IN", "IN", 400_000], ["cash", "TRANSFER_OUT", "OUT", 400_000]]);
    expect(await accountBalance(p, ids.cash)).toBe(600_000);
    expect(await accountBalance(p, ids.bank)).toBe(400_000);
    expect(await p.financialTransaction.count({ where: { type: "EXPENSE" } })).toBe(0);
    expect((await createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 400_000, occurredAt: T("2026-11-05T05:00:00Z"), idempotencyKey: "acc-tr-0001" }, director)).replayed).toBe(true);
    await expect(createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 5_000_000, occurredAt: T("2026-11-06T05:00:00Z"), idempotencyKey: "acc-tr-big" }, director, T("2026-11-06T05:00:00Z"))).rejects.toThrow(/yetarli/);
    await expect(createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.cash, amount: 1, occurredAt: T("2026-11-06T05:00:00Z"), idempotencyKey: "acc-tr-same" }, director, T("2026-11-06T05:00:00Z"))).rejects.toThrow(/o'ziga/);
    await expect(createTransfer(p, { fromAccountId: ids.cash, toAccountId: ids.bank, amount: 1, occurredAt: T("2026-11-06T05:00:00Z"), idempotencyKey: "acc-tr-mgr" }, { userId: "m", role: "MANAGER", branchId: ids.branch })).rejects.toThrow(FinanceError);

    const rev = await reverseTransfer(p, { transferId: r.transfer.id, reason: "Xato o'tkazma", idempotencyKey: "acc-tr-rev-0001" }, director, T("2026-11-07T05:00:00Z"));
    expect(rev.reversalOfId).toBe(r.transfer.id);
    expect((await p.transfer.findUniqueOrThrow({ where: { id: r.transfer.id } })).status).toBe("REVERSED");
    expect(await accountBalance(p, ids.cash)).toBe(1_000_000);
    expect(await accountBalance(p, ids.bank)).toBe(0);
    expect(await p.transfer.count()).toBe(2); // asl qator o'chirilmagan
    await expect(reverseTransfer(p, { transferId: r.transfer.id, reason: "yana", idempotencyKey: "acc-tr-rev-0002" }, director)).rejects.toThrow(/allaqachon/);
  });
});
