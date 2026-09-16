// Finance V2 — kassa balansi va ko'chirma (statement). Balans hech qaerda
// saqlanmaydi: Σ IN − Σ OUT (ledger, occurredAt bo'yicha). Ochilish balansi ham
// ledgerdagi OPENING_BALANCE qatori.

import type { FinancialAccount, FinancialTransaction } from "@prisma/client";

import type { FinanceDb } from "../db";

export interface AccountBalance {
  accountId: string;
  inflow: number;
  outflow: number;
  balance: number;
}

async function sums(db: FinanceDb, accountIds: string[], where: Record<string, unknown>): Promise<Map<string, { inflow: number; outflow: number }>> {
  const rows = await db.financialTransaction.groupBy({ by: ["accountId", "direction"], where: { accountId: { in: accountIds }, ...where }, _sum: { amount: true } });
  const out = new Map<string, { inflow: number; outflow: number }>();
  for (const id of accountIds) out.set(id, { inflow: 0, outflow: 0 });
  for (const r of rows) {
    const cur = out.get(r.accountId)!;
    if (r.direction === "IN") cur.inflow += r._sum.amount ?? 0;
    else cur.outflow += r._sum.amount ?? 0;
  }
  return out;
}

/** Bir nechta kassa balansi (`at` gacha, default hozir) */
export async function accountBalances(db: FinanceDb, accountIds: string[], at?: Date): Promise<Map<string, AccountBalance>> {
  const s = await sums(db, accountIds, at ? { occurredAt: { lte: at } } : {});
  return new Map([...s.entries()].map(([accountId, v]) => [accountId, { accountId, inflow: v.inflow, outflow: v.outflow, balance: v.inflow - v.outflow }]));
}

export async function accountBalance(db: FinanceDb, accountId: string, at?: Date): Promise<number> {
  return (await accountBalances(db, [accountId], at)).get(accountId)?.balance ?? 0;
}

export interface AccountOverviewRow extends AccountBalance {
  account: FinancialAccount;
}

/** Kassalar ro'yxati balanslari bilan (filial bo'yicha; null = hammasi) */
export async function accountsOverview(db: FinanceDb, opts: { branchId?: string | null; includeInactive?: boolean; at?: Date } = {}): Promise<AccountOverviewRow[]> {
  const accounts = await db.financialAccount.findMany({
    // branchId null/undefined = barcha kassalar (hisobotlar bilan bir xil semantika); markaziy kassalar alohida filtrlanmaydi
    where: { ...(opts.branchId ? { branchId: opts.branchId } : {}), ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: [{ branchId: "asc" }, { type: "asc" }, { name: "asc" }],
  });
  const balances = await accountBalances(db, accounts.map((a) => a.id), opts.at);
  return accounts.map((account) => ({ account, ...(balances.get(account.id) ?? { accountId: account.id, inflow: 0, outflow: 0, balance: 0 }) }));
}

export interface StatementLine {
  tx: FinancialTransaction;
  /** qatordan keyingi balans */
  running: number;
}

export interface AccountStatement {
  accountId: string;
  from: Date;
  to: Date;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  lines: StatementLine[];
}

/** Ko'chirma: [from, to) oralig'i — ochilish, kirim, chiqim, yopilish, qatorlar (occurredAt ↑) */
export async function accountStatement(db: FinanceDb, accountId: string, from: Date, to: Date): Promise<AccountStatement> {
  const before = await sums(db, [accountId], { occurredAt: { lt: from } });
  const opening = (before.get(accountId)?.inflow ?? 0) - (before.get(accountId)?.outflow ?? 0);
  const lines = await db.financialTransaction.findMany({ where: { accountId, occurredAt: { gte: from, lt: to } }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] });
  let running = opening;
  let inflow = 0;
  let outflow = 0;
  const out: StatementLine[] = lines.map((tx) => {
    if (tx.direction === "IN") { inflow += tx.amount; running += tx.amount; } else { outflow += tx.amount; running -= tx.amount; }
    return { tx, running };
  });
  return { accountId, from, to, opening, inflow, outflow, closing: running, lines: out };
}
