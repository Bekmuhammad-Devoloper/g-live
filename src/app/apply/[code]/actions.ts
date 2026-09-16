"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseQuestions } from "../../(app)/links/questions";
import { formatIntlPhone, phoneCountry } from "@/lib/phoneCodes";
import { getLevelCodes } from "@/lib/studyLevels";

export type ApplyState = { ok?: boolean; error?: string };

export type StudyFormat = "ONLINE" | "OFFLINE";

export interface ApplyExtra {
  /** Ta'lim shakli — majburiy */
  format?: StudyFormat;
  /** Oflayn bo'lsa — tanlangan filial */
  branchId?: string;
  /** Onlayn bo'lsa — Telegram username */
  telegram?: string;
  /** Telegram profilidan topilgan ism (faqat izoh uchun) */
  telegramName?: string;
  /** Telefon davlat kodi (ISO: UZ, DE, ...) */
  countryIso?: string;
  level?: string;
}

// Ochiq (login talab qilmaydigan) ariza yuborish — CRM ga real Lead yaratadi.
// `answers` — havolaga biriktirilgan qo'shimcha savollarga javoblar (tartibi savollar bilan bir xil).
// Forma tartibi (2026-09-15 talab): ta'lim shakli → (oflayn: filial) → ism, telefon
// (davlat kodi bilan), (onlayn: Telegram) → daraja.
export async function submitApplication(
  code: string,
  fullName: string,
  phone: string,
  answers: string[] = [],
  extra: ApplyExtra = {},
): Promise<ApplyState> {
  const link = await prisma.vacancyLink.findUnique({ where: { code }, include: { vacancy: true } });
  if (!link) return { error: "Havola topilmadi" };
  if (!link.isActive) return { error: "Havola faol emas" };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { error: "Havolaning muddati o'tgan" };
  if (link.maxSubmissions != null && link.submissions >= link.maxSubmissions) return { error: "Ariza chegarasi to'ldi" };

  const name = fullName.replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return { error: "Ismingizni kiriting" };

  // Ta'lim shakli — majburiy
  const format: StudyFormat | null = extra.format === "ONLINE" || extra.format === "OFFLINE" ? extra.format : null;
  if (!format) return { error: "Ta'lim shaklini tanlang: onlayn yoki oflayn" };

  // Oflayn — filial majburiy va faol bo'lishi shart
  let branchId: string | null = link.vacancy.branchId ?? null;
  if (format === "OFFLINE") {
    const b = extra.branchId ? await prisma.branch.findFirst({ where: { id: extra.branchId, isActive: true }, select: { id: true } }) : null;
    if (!b) return { error: "Filialni tanlang" };
    branchId = b.id;
  }

  // Telefon — tanlangan davlat kodi bilan (O'zbekiston aynan 9 xona, boshqalar 6–12).
  // Ilgari faqat "kamida 7 raqam" tekshirilardi — soxta uzun raqamlar ham o'tardi.
  const country = phoneCountry(String(extra.countryIso ?? "UZ"));
  const tel = formatIntlPhone(country.iso, phone);
  if (!tel) return { error: country.iso === "UZ" ? "Telefon raqamini to'g'ri kiriting: +998 XX XXX XX XX" : `Telefon raqamini to'g'ri kiriting (${country.code} ...)` };

  // Telegram — onlayn uchun; "@" va t.me/ prefikslari tozalanadi
  const tg = String(extra.telegram ?? "").trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@+/, "").slice(0, 64);
  if (format === "ONLINE" && tg && !/^[a-zA-Z0-9_]{3,64}$/.test(tg)) return { error: "Telegram username noto'g'ri (masalan: @username)" };

  // Daraja — faqat ro'yxatdagi qiymat, majburiy
  const levels = await getLevelCodes();
  const levelStr = levels.includes(String(extra.level ?? "")) ? String(extra.level) : null;
  if (!levelStr) return { error: "Darajangizni tanlang" };

  // Qo'shimcha savollar — majburiylari serverda ham tekshiriladi (mijozga ishonmaymiz)
  const questions = parseQuestions(link.vacancy.questions);
  const qa: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = String(answers[i] ?? "").trim().slice(0, 500);
    if (q.required && !a) return { error: `"${q.q}" — javob berilishi shart` };
    // Variantli savolda faqat ro'yxatdagi javob qabul qilinadi
    if (a && q.type === "choice" && q.options && !q.options.includes(a)) {
      return { error: `"${q.q}" — noto'g'ri variant` };
    }
    if (a) qa.push(`${q.q}: ${a}`);
  }

  await prisma.lead.create({
    data: {
      fullName: name,
      phone: tel,
      telegram: format === "ONLINE" && tg ? `@${tg}` : null,
      studyFormat: format,
      level: levelStr,
      source: link.platform,
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      vacancyLinkId: link.id,
      branchId,
      note: [
        `Kurs/vakansiya: ${link.vacancy.title}${link.vacancy.country ? " (" + link.vacancy.country + ")" : ""}`,
        `Ta'lim shakli: ${format === "ONLINE" ? "onlayn" : "oflayn"}`,
        ...(format === "ONLINE" && tg ? [`Telegram: @${tg}${extra.telegramName ? " — " + String(extra.telegramName).trim().slice(0, 80) : ""}`] : []),
        ...qa, // savollarga javoblar — CRM'da lid izohida ko'rinadi
      ].join("\n"),
      stage: "NEW",
    },
  });
  await prisma.vacancyLink.update({
    where: { id: link.id },
    data: { submissions: { increment: 1 }, lastSubmissionAt: new Date() },
  });
  revalidatePath("/links");
  return { ok: true };
}

/* ─── Telegram username tekshiruvi ────────────────────────────────────
   Ochiq profil sahifasi t.me/<username> og:title / og:image / og:description
   beradi. Mavjud bo'lmasa og:title "Telegram: Contact @..." bo'ladi.
   Formada yozilayotganda chaqiriladi — natija 10 daqiqa xotirada keshlanadi
   (har harfda t.me ga bormaslik uchun). Faqat ma'lumot: ism/rasm ko'rsatiladi,
   ariza baribir foydalanuvchi yozgan ism bilan yuboriladi.                 */

export type TelegramProfile = { ok: true; username: string; name: string; photo: string | null; bio: string | null } | { ok: false; username: string };

const TG_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const tgCache = new Map<string, { at: number; v: TelegramProfile }>();
const TG_TTL = 10 * 60 * 1000;

const decodeHtml = (t: string) => t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const meta = (html: string, prop: string) => decodeHtml(new RegExp(`<meta property="og:${prop}" content="([^"]*)"`).exec(html)?.[1] ?? "");

export async function lookupTelegram(raw: string): Promise<TelegramProfile> {
  const username = String(raw ?? "").trim().replace(/^@+/, "");
  if (!TG_RE.test(username)) return { ok: false, username };

  const key = username.toLowerCase();
  const hit = tgCache.get(key);
  if (hit && Date.now() - hit.at < TG_TTL) return hit.v;

  let v: TelegramProfile = { ok: false, username };
  try {
    const res = await fetch(`https://t.me/${username}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GermaniyaLive/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const html = await res.text();
      const title = meta(html, "title");
      // Mavjud profil: sahifada tgme_page_title bor va sarlavha "Telegram: Contact" emas
      if (html.includes('class="tgme_page_title"') && !/^Telegram: Contact/i.test(title) && title) {
        const photo = html.includes("tgme_page_photo_image") ? meta(html, "image") || null : null;
        const bio = meta(html, "description").trim().slice(0, 160) || null;
        v = { ok: true, username, name: title.slice(0, 80), photo: photo && /^https:\/\//.test(photo) ? photo : null, bio };
      }
    }
  } catch {
    /* tarmoq xatosi — "topilmadi" emas, shunchaki ko'rsatmaymiz */
    return { ok: false, username };
  }
  tgCache.set(key, { at: Date.now(), v });
  return v;
}
