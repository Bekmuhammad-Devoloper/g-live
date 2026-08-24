// Chek (kvitansiya) yuklash siyosati — CEO sozlamalaridan boshqariladi.
//
// Bu fayl ATAYLAB toza: prisma/server importi yo'q, shuning uchun uni
// client komponent ham (sozlamalar UI, to'lov formasi) import qila oladi.
// Qiymatni bazadan o'qish `getSetting(RECEIPT_MODE_KEY)` orqali server
// tomonda bajariladi va propda uzatiladi.

export const RECEIPT_MODE_KEY = "payments.receiptMode";

export type ReceiptMode = "optional" | "noncash" | "always";

export const RECEIPT_MODES: ReceiptMode[] = ["optional", "noncash", "always"];

/** Sukut bo'yicha — naqd pulsiz to'lovlarda chek talab qilinadi (avvalgi xatti-harakat). */
export const DEFAULT_RECEIPT_MODE: ReceiptMode = "noncash";

export const RECEIPT_MODE_LABELS: Record<ReceiptMode, { uz: string; ru: string; en: string }> = {
  optional: { uz: "Ixtiyoriy", ru: "Необязательно", en: "Optional" },
  noncash: { uz: "Naqd pulsiz to'lovlarda majburiy", ru: "Обязательно для безналичных", en: "Required for non-cash" },
  always: { uz: "Har doim majburiy", ru: "Всегда обязательно", en: "Always required" },
};

export const RECEIPT_MODE_HINTS: Record<ReceiptMode, { uz: string; ru: string; en: string }> = {
  optional: {
    uz: "Chek hech qachon talab qilinmaydi — kassir xohlasa yuklaydi.",
    ru: "Чек никогда не требуется — кассир загружает по желанию.",
    en: "A receipt is never required — the cashier may attach one if they wish.",
  },
  noncash: {
    uz: "Karta va bank hisobi to'lovlarida chek shart, naqd pulda ixtiyoriy.",
    ru: "Для карты и банковского счёта чек обязателен, для наличных — нет.",
    en: "Required for card and bank transfers; optional for cash.",
  },
  always: {
    uz: "Barcha to'lovlarda, naqd pulda ham, chek yuklash shart.",
    ru: "Чек обязателен для всех платежей, включая наличные.",
    en: "A receipt is required for every payment, including cash.",
  },
};

/** Noma'lum/buzilgan qiymatda ham xavfsiz standart qaytaradi. */
export function parseReceiptMode(raw: string | null | undefined): ReceiptMode {
  return RECEIPT_MODES.includes(raw as ReceiptMode) ? (raw as ReceiptMode) : DEFAULT_RECEIPT_MODE;
}

/** Naqd pul hisoblanmaydigan (chek qoldiradigan) to'lov usullari. */
const NON_CASH = new Set(["CARD", "BANK", "CLICK", "PAYME", "UZUM", "TRANSFER", "HUMO"]);

/** Shu usul uchun chek majburiymi? */
export function isReceiptRequired(mode: ReceiptMode, method: string): boolean {
  if (mode === "optional") return false;
  if (mode === "always") return true;
  return NON_CASH.has(method); // "noncash"
}
