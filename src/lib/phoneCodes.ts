// Ochiq ariza formasidagi telefon uchun davlat kodlari.
// Ikki guruh: MDH (standart — O'zbekiston) va Yevropa (Germaniyada yashovchilar uchun).
// Ro'yxat 2026-09-15 talab bo'yicha; tartib — berilgan tartib.

export interface PhoneCountry {
  iso: string;
  code: string; // "+998"
  flag: string;
  name: string; // o'zbekcha (forma o'zbek tilida)
  group: "cis" | "eu";
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  // ── MDH ──
  { iso: "UZ", code: "+998", flag: "🇺🇿", name: "O‘zbekiston", group: "cis" },
  { iso: "RU", code: "+7", flag: "🇷🇺", name: "Rossiya", group: "cis" },
  { iso: "KZ", code: "+7", flag: "🇰🇿", name: "Qozog‘iston", group: "cis" },
  { iso: "BY", code: "+375", flag: "🇧🇾", name: "Belarus", group: "cis" },
  { iso: "KG", code: "+996", flag: "🇰🇬", name: "Qirg‘iziston", group: "cis" },
  { iso: "TJ", code: "+992", flag: "🇹🇯", name: "Tojikiston", group: "cis" },
  { iso: "TM", code: "+993", flag: "🇹🇲", name: "Turkmaniston", group: "cis" },
  { iso: "AM", code: "+374", flag: "🇦🇲", name: "Armaniston", group: "cis" },
  { iso: "AZ", code: "+994", flag: "🇦🇿", name: "Ozarbayjon", group: "cis" },
  { iso: "MD", code: "+373", flag: "🇲🇩", name: "Moldova", group: "cis" },
  // ── Yevropa ──
  { iso: "DE", code: "+49", flag: "🇩🇪", name: "Germaniya", group: "eu" },
  { iso: "AT", code: "+43", flag: "🇦🇹", name: "Avstriya", group: "eu" },
  { iso: "CH", code: "+41", flag: "🇨🇭", name: "Shveytsariya", group: "eu" },
  { iso: "PL", code: "+48", flag: "🇵🇱", name: "Polsha", group: "eu" },
  { iso: "CZ", code: "+420", flag: "🇨🇿", name: "Chexiya", group: "eu" },
  { iso: "SE", code: "+46", flag: "🇸🇪", name: "Shvetsiya", group: "eu" },
  { iso: "NO", code: "+47", flag: "🇳🇴", name: "Norvegiya", group: "eu" },
  { iso: "DK", code: "+45", flag: "🇩🇰", name: "Daniya", group: "eu" },
  { iso: "RO", code: "+40", flag: "🇷🇴", name: "Ruminiya", group: "eu" },
  { iso: "UA", code: "+380", flag: "🇺🇦", name: "Ukraina", group: "eu" },
  { iso: "TR", code: "+90", flag: "🇹🇷", name: "Turkiya", group: "eu" },
  { iso: "BG", code: "+359", flag: "🇧🇬", name: "Bolgariya", group: "eu" },
  { iso: "HR", code: "+385", flag: "🇭🇷", name: "Xorvatiya", group: "eu" },
  { iso: "RS", code: "+381", flag: "🇷🇸", name: "Serbiya", group: "eu" },
  { iso: "SK", code: "+421", flag: "🇸🇰", name: "Slovakiya", group: "eu" },
];

export const DEFAULT_COUNTRY_ISO = "UZ";

export function phoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0];
}

/** Mahalliy qism uzunligi (raqamlar) — O'zbekiston aynan 9, boshqalar 6–12 */
export function localDigitsOk(iso: string, digits: string): boolean {
  if (iso === "UZ") return digits.length === 9 && /^[2-9]/.test(digits);
  return digits.length >= 6 && digits.length <= 12;
}

/**
 * Xalqaro raqamni saqlash ko'rinishiga keltiradi: "+49 15123456789".
 * O'zbekiston uchun odatdagi "+998 XX XXX XX XX" formati (CRM shunga o'rgangan).
 * Noto'g'ri bo'lsa null.
 */
export function formatIntlPhone(iso: string, raw: string): string | null {
  const c = phoneCountry(iso);
  let d = String(raw ?? "").replace(/\D/g, "");
  const cc = c.code.slice(1);
  // Mamlakat kodi bilan yozilgan bo'lsa olib tashlaymiz
  if (d.startsWith(cc) && localDigitsOk(c.iso, d.slice(cc.length))) d = d.slice(cc.length);
  if (!localDigitsOk(c.iso, d)) return null;
  if (c.iso === "UZ") return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
  return `${c.code} ${d}`;
}
