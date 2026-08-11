// Havolalar moduli — platforma va davlat konstantalari (server + client uchun).

export interface PlatformDef { key: string; label: string; color: string; icon: string }

export const PLATFORMS: PlatformDef[] = [
  { key: "telegram", label: "Telegram", color: "#38bdf8", icon: "telegram" },
  { key: "instagram", label: "Instagram", color: "#f472b6", icon: "instagram" },
  { key: "facebook", label: "Facebook", color: "#3b82f6", icon: "globe" },
  { key: "whatsapp", label: "WhatsApp", color: "#34d399", icon: "phone" },
  { key: "tiktok", label: "TikTok", color: "#94a3b8", icon: "video" },
  { key: "youtube", label: "YouTube", color: "#ef4444", icon: "video" },
  { key: "linkedin", label: "LinkedIn", color: "#1d4ed8", icon: "globe" },
  { key: "bio-link", label: "Bio-link", color: "#a78bfa", icon: "link" },
  { key: "other", label: "Boshqa", color: "#9ca3af", icon: "globe" },
];

export const PLATFORM_MAP: Record<string, PlatformDef> = Object.fromEntries(PLATFORMS.map((p) => [p.key, p]));

export function platform(key: string | null | undefined): PlatformDef {
  return PLATFORM_MAP[key ?? "other"] ?? PLATFORM_MAP.other;
}

export interface CountryDef { name: string; code: string; flag: string }
export const COUNTRIES: CountryDef[] = [
  { name: "O'zbekiston", code: "uz", flag: "🇺🇿" }, // o'quv markazning o'z vakansiyalari
  { name: "Germaniya", code: "de", flag: "🇩🇪" },
  { name: "Bolgariya", code: "bg", flag: "🇧🇬" },
  { name: "Mongoliya", code: "mn", flag: "🇲🇳" },
  { name: "Polsha", code: "pl", flag: "🇵🇱" },
  { name: "Chexiya", code: "cz", flag: "🇨🇿" },
  { name: "Litva", code: "lt", flag: "🇱🇹" },
  { name: "Ruminiya", code: "ro", flag: "🇷🇴" },
  { name: "Rossiya", code: "ru", flag: "🇷🇺" },
  { name: "Janubiy Koreya", code: "kr", flag: "🇰🇷" },
];

export function flagOf(code: string | null | undefined, name?: string | null): string {
  const c = COUNTRIES.find((x) => x.code === code || x.name === name);
  return c?.flag ?? "🌐";
}
