import { ROLES } from "@/lib/constants";

// Lavozimlar (Rollar katalogi) bilan bog'liq umumiy qoidalar — sahifa va action'lar uchun.

/** Rahbariyat bo'limi — bu lavozimlarni faqat direktor beradi */
export const MANAGEMENT_DEPT = "Boshqaruv";

/** Katalogdan o'chirilgan bo'lsa ham direktor uchun doim tanlovda turadigan lavozimlar */
export const MANAGEMENT_POSITIONS = ["Direktor", "Direktor o'rinbosari"] as const;

/** Rahbariyat rollari — berish/olib qo'yish faqat direktor huquqi */
export const MANAGEMENT_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

/** Lavozimi yozilmagan xodim uchun rolidan kelib chiqadigan standart lavozim nomi */
const DEFAULT_POSITION: Record<string, string> = {
  [ROLES.DIRECTOR]: "Direktor",
  [ROLES.DEPUTY_DIRECTOR]: "Direktor o'rinbosari",
  [ROLES.ADMIN]: "Administrator",
  [ROLES.TEACHER]: "O'qituvchi",
  [ROLES.OPERATOR]: "Operator",
  [ROLES.ROP]: "Sotuv bo'limi rahbari (ROP)",
  [ROLES.ACCOUNTANT]: "Moliyachi",
  [ROLES.MANAGER]: "Menejer",
};
export const defaultPositionFor = (role: string): string | null => DEFAULT_POSITION[role] ?? null;
