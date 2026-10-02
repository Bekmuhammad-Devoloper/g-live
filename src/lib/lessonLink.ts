// Dars QR kodi ochadigan qisqa havola: /l/<darsId>.
// Havola ochiq (seanssiz ham ochiladi) va o'zi yo'l ko'rsatadi: ilova yo'q bo'lsa
// yuklab olish, seans yo'q bo'lsa kirish, faol o'quvchi bo'lsa — dars videosi.

export const lessonLinkPath = (lessonId: string): string => `/l/${lessonId}`;

/**
 * Kirishdan keyin qaytish manzili. Faqat dars havolasi qabul qilinadi —
 * ixtiyoriy manzilga yo'naltirish (open redirect) bo'lmasin.
 */
export function safeNextPath(v: unknown): string | null {
  return typeof v === "string" && /^\/l\/[A-Za-z0-9_-]{8,40}$/.test(v) ? v : null;
}

/** Android ilovasi (Capacitor qobig'i) ichidan kelgan so'rovmi — User-Agent belgisi bo'yicha */
export const isNativeAppUa = (ua: string): boolean => /GermaniyaLiveApp\//.test(ua);
