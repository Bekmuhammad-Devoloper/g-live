// Finance V2 — domen xatolari. Action qatlami `code`ni klientga qaytaradi,
// klient tilga mos xabar ko'rsatadi. Xom Prisma xatolari klientga chiqmaydi.

export type FinanceErrorCode =
  | "forbidden"
  | "not_found"
  | "validation"
  | "period_locked"
  | "salary_period_locked"
  | "conflict"
  | "insufficient"
  | "duplicate"
  | "feature_disabled"
  | "state";

export class FinanceError extends Error {
  readonly code: FinanceErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: FinanceErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "FinanceError";
    this.code = code;
    this.details = details;
  }
}

export function isFinanceError(e: unknown): e is FinanceError {
  return e instanceof FinanceError;
}

/** Action'lar uchun bir xil natija shakli */
export type FinanceResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: FinanceErrorCode; message: string; details?: Record<string, unknown> };

export function toFinanceResult(e: unknown): FinanceResult<never> {
  if (isFinanceError(e)) return { ok: false, error: e.code, message: e.message, details: e.details };
  // Kutilmagan xato — serverda log, klientga umumiy xabar
  console.error("finance: kutilmagan xato", e);
  return { ok: false, error: "conflict", message: "Amal bajarilmadi. Qaytadan urinib ko'ring." };
}
