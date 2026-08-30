// Daraja rangi — ma'muriyat bitta hex tanlaydi, kartochka gradienti shundan
// hosil bo'ladi (avvalgi qo'lda yozilgan gradientlar bilan bir xil uslub).
// Bu fayl toza funksiyalardan iborat — mijoz komponentlarda ham ishlaydi.

export const PRESET_COLORS = [
  "#2d5f8a", // ko'k
  "#0e7490", // moviy
  "#6d28d9", // binafsha
  "#a83a7a", // pushti
  "#b45309", // to'q sariq
  "#15803d", // yashil
  "#be123c", // qizil
  "#475569", // kulrang
];

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x0e7490;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hsl = ({ h, s, l }: HSL, k: number, max = 1) =>
  `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(clamp(l * k, 0.04, max) * 100).toFixed(0)}%)`;

/** Kartochka foni: to'qdan ochga uch pog'onali gradient */
export function levelGradient(color: string): string {
  const c = hexToHsl(color);
  return `linear-gradient(135deg, ${hsl(c, 0.7)} 0%, ${hsl(c, 1)} 55%, ${hsl(c, 1.4, 0.78)} 100%)`;
}

/** Faqat o'z serverimizga yuklangan rasm (tashqi manzil o'tmaydi) */
export const isSafeBanner = (u: string) => /^\/uploads\/[\w.-]+$/.test(u);

/** Daraja kodi to'g'ri yozilganmi: A1, B2.1, Start ... */
export const isLevelCode = (c: string) => /^[A-Za-z][A-Za-z0-9.\- ]{0,11}$/.test(c.trim());
