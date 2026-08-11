// Havolalar moduli — server va client o'rtasida uzatiladigan turlar.
// DIQQAT: bu yerda faqat oddiy (serializatsiya qilinadigan) qiymatlar bo'lsin —
// funksiya server komponentdan client komponentga o'tolmaydi.

export interface VLink {
  id: string;
  code: string;
  name: string | null;
  platform: string;
  views: number;
  submissions: number;
  isActive: boolean;
  cvr: number;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
}

export interface VVacancy {
  id: string;
  title: string;
  company: string | null;
  country: string | null;
  countryCode: string | null;
  createdAt: string;
  links: VLink[];
  views: number;
  submissions: number;
  activeLinks: number;
}

export interface PlatformStat {
  key: string;
  label: string;
  color: string;
  icon: string;
  links: number;
  views: number;
  submissions: number;
  sharePct: number;
}

export interface CountryOption {
  name: string;
  code: string | null;
}

export interface VacancyOption {
  id: string;
  title: string;
  country: string | null;
  countryCode: string | null;
}

export interface Totals {
  totalLinks: number;
  activeLinks: number;
  totalViews: number;
  totalSubmissions: number;
}

/** Ro'yxatdagi yaratilgan havola (natija oynasi uchun). */
export interface CreatedLink {
  code: string;
  platform: string;
}
