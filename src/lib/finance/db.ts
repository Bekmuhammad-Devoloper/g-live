// Finance V2 — transaction yordamchisi.
//
// Barcha dvigatel funksiyalari `FinanceDb` (PrismaClient yoki TransactionClient)
// qabul qiladi — testlar vaqtinchalik bazani beradi, action'lar `withFinanceTx`
// orqali bitta tranzaksiya ichida chaqiradi. SQLite bitta yozuvchi: qisqa,
// idempotent tranzaksiyalar + `database is locked` da qayta urinish.

import { Prisma, type PrismaClient } from "@prisma/client";

export type FinanceDb = PrismaClient | Prisma.TransactionClient;

export interface FinanceTxOptions {
  /** Tranzaksiya boshlanishini kutish (ms) */
  maxWait?: number;
  /** Tranzaksiya davomiyligi chegarasi (ms) */
  timeout?: number;
  /** SQLITE_BUSY da urinishlar soni */
  attempts?: number;
}

const RETRYABLE = [/database is locked/i, /SQLITE_BUSY/i, /Transaction already closed/i];

function isRetryable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P1008")) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return RETRYABLE.some((r) => r.test(msg));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `client.$transaction` + qayta urinish. `fn` IDEMPOTENT bo'lishi shart
 * (idempotencyKey/unique) — qayta urinishda dublikat yozilmasin.
 */
export async function withFinanceTx<T>(client: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>, opts: FinanceTxOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.$transaction(fn, { maxWait: opts.maxWait ?? 15_000, timeout: opts.timeout ?? 60_000 });
    } catch (e) {
      lastError = e;
      if (!isRetryable(e) || i === attempts - 1) throw e;
      await sleep(50 * (i + 1) + Math.floor(Math.random() * 100));
    }
  }
  throw lastError;
}

/** Prisma unique (P2002) — idempotent qayta urinishlarda "allaqachon bor" ma'nosida */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
