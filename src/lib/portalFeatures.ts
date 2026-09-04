import "server-only";
import { getSettings, setSetting } from "./settings";
import type { Locale } from "./constants";

// O'quvchi portalidagi bo'limlarni yoqish/o'chirish.
// Menejer (va rahbariyat) Sozlamalar > O'quvchi portali bo'limidan boshqaradi.
// Sozlama yozilmagan bo'lsa — bo'lim YOQILGAN hisoblanadi (eski holat buzilmaydi).

export type PortalFeature =
  | "uben" | "worterbuch" | "market" | "battle" | "gehirn" | "lehrer" | "mitteilungen";

export const PORTAL_FEATURES: {
  key: PortalFeature;
  path: string;
  icon: string;
  label: Record<Locale, string>;
  desc: Record<Locale, string>;
}[] = [
  { key: "uben", path: "/student/uben", icon: "clipboard",
    label: { uz: "Mashqlar", ru: "Упражнения", en: "Practice", de: "Üben" },
    desc: { uz: "Uy vazifalari va topshiriqlar", ru: "Домашние задания", en: "Homework and tasks", de: "Hausaufgaben" } },
  { key: "worterbuch", path: "/student/worterbuch", icon: "book",
    label: { uz: "Lug'at", ru: "Словарь", en: "Dictionary", de: "Wörterbuch" },
    desc: { uz: "Shaxsiy so'zlar daftari", ru: "Личный словарь", en: "Personal vocabulary", de: "Persönliches Vokabelheft" } },
  { key: "lehrer", path: "/student/lehrer", icon: "mail",
    label: { uz: "Savol-javob", ru: "Вопрос-ответ", en: "Ask the teacher", de: "Frag den Lehrer" },
    desc: { uz: "O'quvchi ustozga savol yozadi", ru: "Ученик пишет преподавателю", en: "Student writes to the teacher", de: "Schüler schreibt dem Lehrer" } },
  { key: "battle", path: "/student/battle", icon: "trophy",
    label: { uz: "Jang", ru: "Битва", en: "Battle", de: "Duell" },
    desc: { uz: "O'quvchilar o'rtasidagi bellashuv", ru: "Соревнование учеников", en: "Student competition", de: "Schülerwettbewerb" } },
  { key: "market", path: "/student/market", icon: "coins",
    label: { uz: "Market", ru: "Маркет", en: "Market", de: "Markt" },
    desc: { uz: "Tangalarga sovg'a almashish", ru: "Обмен монет на призы", en: "Exchange coins for rewards", de: "Münzen gegen Preise" } },
  // ── Ikkinchi miya — VAQTINCHA O'CHIRILGAN (2026-09-04) ──
  // Kartochkasi /student/profil da kommentga olingan, shuning uchun
  // menejer panelida ham "o'lik" tugma qolmasin deb chiqarib qo'yildi.
  // Qaytarish: pastdagi kommentni oching.
  // { key: "gehirn", path: "/student/gehirn", icon: "layers",
  //   label: { uz: "Ikkinchi miya", ru: "Второй мозг", en: "Second brain", de: "Zweites Gehirn" },
  //   desc: { uz: "Shaxsiy bilim bazasi", ru: "Личная база знаний", en: "Personal knowledge base", de: "Persönliche Wissensbasis" } },
  { key: "mitteilungen", path: "/student/mitteilungen", icon: "bell",
    label: { uz: "Bildirishnomalar", ru: "Уведомления", en: "Notifications", de: "Mitteilungen" },
    desc: { uz: "Markazdan kelgan xabarlar", ru: "Сообщения от центра", en: "Messages from the centre", de: "Nachrichten vom Zentrum" } },
];

const keyOf = (f: PortalFeature) => `portal.${f}`;

export type PortalFlags = Record<PortalFeature, boolean>;

/** Barcha bo'limlar holati. Yozilmagani — yoqilgan. */
export async function getPortalFlags(): Promise<PortalFlags> {
  const rows = await getSettings(PORTAL_FEATURES.map((f) => keyOf(f.key)));
  const out = {} as PortalFlags;
  for (const f of PORTAL_FEATURES) out[f.key] = rows[keyOf(f.key)] !== "off";
  return out;
}

/** Bitta bo'lim yoqilganmi (sahifa guardlari uchun). */
export async function isPortalFeatureOn(f: PortalFeature): Promise<boolean> {
  const rows = await getSettings([keyOf(f)]);
  return rows[keyOf(f)] !== "off";
}

/** Holatni saqlash (menejer panelidan). */
export async function setPortalFlag(f: PortalFeature, on: boolean): Promise<void> {
  await setSetting(keyOf(f), on ? "on" : "off");
}
