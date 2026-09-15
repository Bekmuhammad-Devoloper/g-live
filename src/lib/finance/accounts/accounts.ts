// Finance V2 — kassalar (FinancialAccount). To'lov usuli ≠ pul qayerda turishi.
// Har filial uchun standart to'plam kerak bo'lganda yaratiladi (idempotent);
// usul → kassa turi xaritasi `Setting finance.accountMap` (JSON) bilan sozlanadi,
// bo'lmasa PAYMENT_METHOD_TO_ACCOUNT_TYPE (S17).

import type { FinancialAccount } from "@prisma/client";

import { FINANCIAL_ACCOUNT_TYPES, PAYMENT_METHOD_TO_ACCOUNT_TYPE, type FinancialAccountType } from "../constants";
import type { FinanceDb } from "../db";
import { isUniqueViolation } from "../db";
import { FinanceError } from "../errors";
import { financeAudit } from "../audit";
import { assertMoney } from "../money";

export const ACCOUNT_MAP_SETTING_KEY = "finance.accountMap";

export const DEFAULT_ACCOUNT_NAMES: Record<FinancialAccountType, string> = {
  MAIN_CASH: "Asosiy kassa",
  TERMINAL: "Terminal",
  BANK: "Bank hisobi",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  CUSTOM: "Boshqa",
};

const DEFAULT_SET: FinancialAccountType[] = ["MAIN_CASH", "TERMINAL", "BANK", "CLICK", "PAYME", "UZUM"];

/** Usul → kassa turi (sozlanadigan). Noma'lum usul → MAIN_CASH */
export async function accountTypeForMethod(db: FinanceDb, method: string): Promise<FinancialAccountType> {
  const m = method.toUpperCase();
  const row = await db.setting.findUnique({ where: { key: ACCOUNT_MAP_SETTING_KEY } });
  if (row?.value) {
    try {
      const map = JSON.parse(row.value) as Record<string, string>;
      const t = map[m];
      if (t && (FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(t)) return t as FinancialAccountType;
    } catch {
      /* buzuq JSON — standart xaritaga o'tiladi */
    }
  }
  return PAYMENT_METHOD_TO_ACCOUNT_TYPE[m] ?? "MAIN_CASH";
}

/** Filial uchun standart kassalar (yo'q bo'lsa yaratiladi). branchId null = markaziy */
export async function ensureDefaultAccounts(db: FinanceDb, branchId: string | null, actorId?: string | null): Promise<FinancialAccount[]> {
  const existing = await db.financialAccount.findMany({ where: { branchId } });
  const have = new Set(existing.map((a) => a.type));
  const out = [...existing];
  for (const type of DEFAULT_SET) {
    if (have.has(type)) continue;
    try {
      const created = await db.financialAccount.create({ data: { branchId, type, name: DEFAULT_ACCOUNT_NAMES[type], createdById: actorId ?? null } });
      await financeAudit(db, { actorId, action: "CREATE", entityType: "FinancialAccount", entityId: created.id, newValue: { branchId, type, name: created.name }, reason: "standart kassa" });
      out.push(created);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return out;
}

/** Usul bo'yicha faol kassa: filialniki → markaziy → filial uchun standart yaratiladi */
export async function accountForMethod(db: FinanceDb, branchId: string | null, method: string, actorId?: string | null): Promise<FinancialAccount> {
  const type = await accountTypeForMethod(db, method);
  const pick = (rows: FinancialAccount[]) => rows.find((a) => a.type === type && a.isActive) ?? null;
  const own = pick(await db.financialAccount.findMany({ where: { branchId } }));
  if (own) return own;
  if (branchId) {
    const central = pick(await db.financialAccount.findMany({ where: { branchId: null } }));
    if (central) return central;
  }
  const created = pick(await ensureDefaultAccounts(db, branchId, actorId));
  if (!created) throw new FinanceError("not_found", `Kassa topilmadi: ${type}`);
  return created;
}

export interface CreateAccountInput {
  branchId?: string | null;
  name: string;
  type: FinancialAccountType;
  openingBalance?: number;
  openingAt?: Date;
  note?: string | null;
  actorId?: string | null;
}

/** Yangi kassa; ochilish balansi > 0 bo'lsa ledgerga OPENING_BALANCE qatori (tarixiy fakt) */
export async function createAccount(db: FinanceDb, i: CreateAccountInput): Promise<FinancialAccount> {
  if (i.name.trim().length < 2) throw new FinanceError("validation", "Kassa nomi kamida 2 belgi");
  if (!(FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(i.type)) throw new FinanceError("validation", "Kassa turi noto'g'ri");
  const opening = assertMoney(i.openingBalance ?? 0, "ochilish balansi");
  const openingAt = i.openingAt ?? new Date();
  const acc = await db.financialAccount.create({
    data: { branchId: i.branchId ?? null, name: i.name.trim(), type: i.type, openingBalance: opening, openingAt, note: i.note ?? null, createdById: i.actorId ?? null },
  });
  if (opening > 0) {
    await db.financialTransaction.create({
      data: {
        accountId: acc.id, branchId: acc.branchId, type: "OPENING_BALANCE", direction: "IN", amount: opening,
        referenceType: "FinancialAccount", referenceId: acc.id, sequence: 0, occurredAt: openingAt,
        idempotencyKey: `FinancialAccount:${acc.id}:IN:0`, createdById: i.actorId ?? null, note: "Ochilish balansi",
      },
    });
  }
  await financeAudit(db, { actorId: i.actorId, action: "CREATE", entityType: "FinancialAccount", entityId: acc.id, newValue: { name: acc.name, type: acc.type, branchId: acc.branchId, openingBalance: opening }, reason: i.note ?? null });
  return acc;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  isActive?: boolean;
  note?: string | null;
  actorId?: string | null;
}

/** Faqat nom/faollik/izoh — `openingBalance/openingAt` va `type` HECH QACHON o'zgartirilmaydi (tarixiy fakt) */
export async function updateAccount(db: FinanceDb, i: UpdateAccountInput): Promise<FinancialAccount> {
  const acc = await db.financialAccount.findUnique({ where: { id: i.id } });
  if (!acc) throw new FinanceError("not_found", "Kassa topilmadi");
  if (i.name !== undefined && i.name.trim().length < 2) throw new FinanceError("validation", "Kassa nomi kamida 2 belgi");
  const updated = await db.financialAccount.update({ where: { id: i.id }, data: { ...(i.name !== undefined ? { name: i.name.trim() } : {}), ...(i.isActive !== undefined ? { isActive: i.isActive } : {}), ...(i.note !== undefined ? { note: i.note } : {}) } });
  await financeAudit(db, { actorId: i.actorId, action: "UPDATE", entityType: "FinancialAccount", entityId: i.id, oldValue: { name: acc.name, isActive: acc.isActive, note: acc.note }, newValue: { name: updated.name, isActive: updated.isActive, note: updated.note } });
  return updated;
}
