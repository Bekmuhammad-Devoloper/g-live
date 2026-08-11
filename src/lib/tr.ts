import type { Locale } from "./constants";

// Inline tarjima yordamchisi — markaziy lug'atsiz, joyida 3 til beriladi.
// Ishlatish: tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })
export function tr(locale: Locale, s: { uz: string; ru: string; en: string }): string {
  return s[locale] ?? s.uz;
}
