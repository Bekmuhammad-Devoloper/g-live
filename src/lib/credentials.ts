import { tr } from "./tr";
import type { Locale } from "./constants";

const INVISIBLE = /\p{Cf}/gu;
const STAFF_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizeLogin(raw: unknown): string {
  return String(raw ?? "").replace(INVISIBLE, "").trim().toLowerCase();
}

export function normalizePassword(raw: unknown): string {
  return String(raw ?? "").replace(INVISIBLE, "").trim();
}

export function isValidStaffEmail(email: string): boolean {
  return STAFF_EMAIL_RE.test(email);
}

export function archivedEmailError(locale: Locale, fullName: string): string {
  return tr(locale, {
    uz: `Bu email arxivdagi xodimga tegishli (${fullName}). Avval «Arxiv» bo'limidan tiklang, keyin parolini o'rnating.`,
    ru: `Этот email принадлежит сотруднику в архиве (${fullName}). Сначала восстановите его в разделе «Архив», затем задайте пароль.`,
    en: `This email belongs to an archived staff member (${fullName}). Restore them from "Archive" first, then set the password.`,
    de: `Diese E-Mail gehört zu einem archivierten Mitarbeiter (${fullName}). Zuerst im „Archiv" wiederherstellen, dann das Passwort setzen.`,
  });
}

export function staffEmailError(locale: Locale): string {
  return tr(locale, {
    uz: "Email noto'g'ri: faqat lotin harflari, raqamlar va . _ - + belgilari (masalan: ism.familiya@gmail.com)",
    ru: "Неверный email: только латинские буквы, цифры и символы . _ - + (например: imya.familiya@gmail.com)",
    en: "Invalid email: Latin letters, digits and . _ - + only (e.g. name.surname@gmail.com)",
    de: "Ungültige E-Mail: nur lateinische Buchstaben, Ziffern und . _ - + (z. B. name.nachname@gmail.com)",
  });
}
