import type { Locale, LocaleText } from "./constants";

// Inline tarjima yordamchisi — markaziy lug'atsiz, joyida 4 til beriladi.
// Ishlatish: tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })
// `de` ixtiyoriy: berilmagan joyda inglizchaga (u ham bo'lmasa o'zbekchaga) tushadi,
// shu tufayli eski 3 tilli chaqiruvlar buzilmaydi.
export function tr(locale: Locale, s: LocaleText): string {
  return s[locale] ?? s.en ?? s.uz;
}
