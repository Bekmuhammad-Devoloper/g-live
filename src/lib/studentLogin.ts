import "server-only";
import { prisma } from "./db";

// O'quvchi uchun ilova hisobi: login va parol.
//
// Sukut bo'yicha qoida (ma'muriyat o'zgartirmasa):
//   login  — ismi kichik harflarda (lotinchada, bo'shliqsiz)
//   parol  — telefon raqami (raqamlari)
// Ma'muriyat istalgan vaqtda ikkalasini ham almashtira oladi.

// Kirill va o'zbek harflarini lotinchaga o'giramiz — login faqat
// ASCII bo'lishi kerak (klaviaturada terish oson bo'lsin).
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j",
  з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o", ф: "f", х: "x", ҳ: "h",
  ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e",
  ю: "yu", я: "ya", ä: "a", ö: "o", ü: "u", ß: "ss", ʻ: "", "'": "", "`": "",
};

export function translit(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

export const phoneDigits = (phone: string | null | undefined): string => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.startsWith("998") && d.length > 9 ? d.slice(3) : d;
};

// Ism bo'yicha bo'sh login topamiz: "qodirova", band bo'lsa "qodirova2" ...
// Qoida: yozilgan ismning BIRINCHI so'zi (CRM da ba'zan "Familiya Ism",
// ba'zan "Ism Familiya" tartibi uchraydi — birinchi so'z eng tushunarli).
export async function freeLogin(fullName: string, exceptUserId?: string): Promise<string> {
  const parts = fullName.trim().split(/\s+/);
  const base = translit(parts[0]) || translit(parts.slice(1).join("")) || "student";

  for (let i = 0; i < 60; i++) {
    const candidate = i === 0 ? base : base + (i + 1);
    const busy = await prisma.user.findUnique({ where: { email: candidate }, select: { id: true } });
    if (!busy || busy.id === exceptUserId) return candidate;
  }
  return base + Date.now().toString().slice(-4);
}

// Parol: telefon raqami; raqam bo'lmasa tasodifiy 6 xonali son
export function defaultPassword(phone: string | null | undefined): string {
  const d = phoneDigits(phone);
  return d.length >= 6 ? d : String(Math.floor(100000 + Math.random() * 900000));
}
