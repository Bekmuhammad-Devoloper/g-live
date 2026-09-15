// Finance V2 — statuslar, turlar va chegaralar.
//
// Schema'da enum yo'q (SQLite/Postgres o'rtasida ko'chirish uchun — schema
// sarlavhasidagi qaror), shu sabab qiymatlar shu yerda `as const` ro'yxatlar
// bilan qulflanadi va zod/TypeScript orqali tekshiriladi. Prisma modeli
// izohlaridagi nomlar shu ro'yxatlarga ishora qiladi.

/** Foiz saqlash birligi: basis point. 40% = 4000. Float hech qaerda ishlatilmaydi. */
export const RATE_BP_SCALE = 10_000;

/** Timezone — barcha oy chegaralari shu taqvimda (yozgi vaqt yo'q, UTC+5). */
export const FINANCE_TZ = "Asia/Tashkent";

/** Setting kalitlari (feature flag va cutover) */
export const FINANCE_SETTING_KEYS = {
  enabled: "finance.v2.enabled",
  cutoverAt: "finance.v2.cutoverAt",
} as const;

/** Tasdiqlangan cutover — 2026-10-01 00:00 Asia/Tashkent (S1). Setting bo'lmasa shu. */
export const FINANCE_V2_DEFAULT_CUTOVER_ISO = "2026-10-01T00:00:00+05:00";

// ─── Kassa / ledger ───
export const FINANCIAL_ACCOUNT_TYPES = ["MAIN_CASH", "CLICK", "PAYME", "UZUM", "TERMINAL", "BANK", "CUSTOM"] as const;
export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const LEDGER_TYPES = [
  "OPENING_BALANCE", // kassa ochilish balansi — tarixiy fakt, referenceType FinancialAccount
  "STUDENT_PAYMENT",
  "EXPENSE",
  "SALARY_PAYOUT",
  "REFUND",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT",
  "OTHER_INCOME",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const LEDGER_DIRECTIONS = ["IN", "OUT"] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_REFERENCE_TYPES = ["FinancialAccount", "Payment", "Expense", "SalaryPayout", "Refund", "Transfer", "Adjustment"] as const;
export type LedgerReferenceType = (typeof LEDGER_REFERENCE_TYPES)[number];

/** To'lov usuli → standart kassa turi (S17). HUMO — TERMINAL. */
export const PAYMENT_METHOD_TO_ACCOUNT_TYPE: Record<string, FinancialAccountType> = {
  CASH: "MAIN_CASH",
  CARD: "TERMINAL",
  HUMO: "TERMINAL",
  TERMINAL: "TERMINAL",
  BANK: "BANK",
  TRANSFER: "BANK",
  CLICK: "CLICK",
  PAYME: "PAYME",
  UZUM: "UZUM",
};

// ─── Billing ───
export const CHARGE_KINDS = ["MONTHLY", "MANUAL_DEBT", "OPENING_BALANCE", "ADJUSTMENT"] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const CHARGE_STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "WAIVED", "CANCELLED"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const DISCOUNT_TYPES = ["PERCENT", "FIXED"] as const;

export const MID_MONTH_JOIN_MODES = ["FULL_MONTH", "PRO_RATA_DAYS", "PRO_RATA_LESSONS"] as const;
/** UI'da hozircha faqat shu ishlaydi (S3) */
export const SUPPORTED_MID_MONTH_JOIN_MODES = ["FULL_MONTH"] as const;

export const ALLOCATION_KINDS = ["ALLOCATION", "REVERSAL"] as const;
export type AllocationKind = (typeof ALLOCATION_KINDS)[number];

export const ALLOCATION_SOURCES = ["AUTO_FIFO", "CREDIT_APPLY", "MANUAL", "BACKFILL"] as const;
export type AllocationSource = (typeof ALLOCATION_SOURCES)[number];

// ─── Payment (V2 qo'shimchalari) ───
/** Eski Payment qatorlarining V2 dagi roli (Payment.legacyRole) */
export const PAYMENT_LEGACY_ROLES = ["DEBT", "REFUND"] as const;
/** V2 qo'shgan status: correction bilan almashtirilgan to'lov */
export const PAYMENT_STATUS_REVERSED = "REVERSED";

export const REFUND_STATUSES = ["DONE", "REVERSED"] as const;
/** CASH_REFUND — o'quvchiga real pul qaytdi; CORRECTION — xato kiritilgan to'lovni bekor qilish (pul aslida kelmagan) */
export const REFUND_KINDS = ["CASH_REFUND", "CORRECTION"] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];
export const RECORD_SOURCES = ["V2", "LEGACY"] as const;

// ─── Teacher compensation ───
export const SALARY_RULE_SCOPES = ["GLOBAL", "BRANCH", "COURSE", "GROUP", "TEACHER", "STUDENT"] as const;
export type SalaryRuleScope = (typeof SALARY_RULE_SCOPES)[number];
/** Eng aniq (specific) qoida yutadi — resolve tartibi (7.1). Assignment-level qoida bundan ham ustun. */
export const SALARY_RULE_PRIORITY: readonly SalaryRuleScope[] = ["STUDENT", "TEACHER", "GROUP", "COURSE", "BRANCH", "GLOBAL"];
/** Eski scope qiymati */
export const LEGACY_SCOPE_ALL = "ALL";
/** Assignment darajasidagi qoida (ASSISTANT va h.k.) — scope bo'yicha resolve qilinmaydi, faqat `GroupTeacherAssignment.compensationRuleId` orqali */
export const ASSIGNMENT_RULE_SCOPE = "ASSIGNMENT";

export const COMPENSATION_TYPES = ["FIXED", "PERCENT", "PER_STUDENT", "PER_LESSON", "PER_HOUR"] as const;
/** Birinchi bosqichda dvigatel qo'llab-quvvatlaydiganlari */
export const SUPPORTED_COMPENSATION_TYPES = ["FIXED", "PERCENT"] as const;

export const ASSIGNMENT_ROLES = ["MAIN", "ASSISTANT"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];
export const ASSIGNMENT_SOURCES = ["KNOWN", "INFERRED"] as const;
/** GroupStudentHistory.source — legacy intervallar INFERRED, noaniq bo'lsa NEEDS_REVIEW */
export const MEMBERSHIP_HISTORY_SOURCES = ["KNOWN", "INFERRED", "NEEDS_REVIEW"] as const;

/** D1: bir xizmat oyida MAIN almashsa commission bo'linishi; faqat REVIEW qo'llab-quvvatlanadi */
export const ASSIGNMENT_SPLIT_MODES = ["REVIEW", "SERVICE_DAYS_RATIO", "LESSONS_RATIO", "MANUAL_SPLIT"] as const;
export const SUPPORTED_ASSIGNMENT_SPLIT_MODES = ["REVIEW"] as const;

export const SALARY_BASE_MODES = ["REAL_PAID_AMOUNT", "FULL_PRICE_EQUIVALENT"] as const;
export type SalaryBaseMode = (typeof SALARY_BASE_MODES)[number];

export const ATTENDANCE_MODES = ["NONE", "PRESENT_RATIO"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export const NO_LESSONS_MODES = ["NO_LESSONS_REVIEW", "NO_LESSONS_AS_FULL", "NO_LESSONS_AS_ZERO"] as const;
/** S9: dars yozuvi bo'lmasa avtomatik to'liq maosh YO'Q — faqat review */
export const SUPPORTED_NO_LESSONS_MODES = ["NO_LESSONS_REVIEW"] as const;

/** Davomat statuslari ichida "qatnashgan" deb hisoblanadiganlar (S9); EXCUSED kirmaydi */
export const DEFAULT_ATTENDANCE_COUNTED_STATUSES = ["PRESENT", "LATE", "ONLINE", "MAKEUP"] as const;

export const EARNING_TYPES = [
  "PAYMENT_COMMISSION",
  "FIXED",
  "BONUS",
  "KPI",
  "PENALTY",
  "REFUND_ADJUSTMENT",
  "MANUAL_ADJUSTMENT",
] as const;
export type EarningType = (typeof EARNING_TYPES)[number];

export const EARNING_STATUSES = ["POSTED", "NEEDS_REVIEW"] as const;
export type EarningStatus = (typeof EARNING_STATUSES)[number];

export const EARNING_REVIEW_REASONS = ["NO_LESSONS_FOUND", "ASSISTANT_NO_RULE", "RATE_SUM_EXCEEDED", "LEGACY_INFERRED", "AMBIGUOUS_ASSIGNMENT"] as const;
export type EarningReviewReason = (typeof EARNING_REVIEW_REASONS)[number];

export const SALARY_PERIOD_STATUSES = ["OPEN", "CALCULATED", "APPROVED", "PARTIALLY_PAID", "PAID", "CLOSED"] as const;
export type SalaryPeriodStatus = (typeof SALARY_PERIOD_STATUSES)[number];
/** Shu holatlardan boshlab yangi earning davrga emas, keyingi ochiq davrga tushadi (settlement) */
export const SALARY_PERIOD_SETTLED_STATUSES: readonly SalaryPeriodStatus[] = ["APPROVED", "PARTIALLY_PAID", "PAID", "CLOSED"];

export const PAYOUT_STATUSES = ["DONE", "REVERSED"] as const;
export const TRANSFER_STATUSES = ["DONE", "REVERSED"] as const;
export const EXPENSE_STATUSES = ["ACTIVE", "REVERSED"] as const;
