import type { Locale, LocaleText } from "./constants";

export function tr(locale: Locale, s: LocaleText): string {
  return s[locale] ?? s.en ?? s.uz;
}
