// Darsning lug'ati — `CourseLesson.topic` maydonidan ajratib olinadi.
//
// O'qituvchi mavzu maydoniga so'zlarni vergul, nuqta-vergul yoki yangi qator
// bilan yozadi, tarjimasi esa chiziqcha bilan ajratiladi:
//
//   der Hund - it, die Katze - mushuk
//   das Haus — uy
//
// Bu mantiq ilgari faqat lug'at sahifasining ichida turardi. Dars sahifasi
// ham xuddi shu so'zlarni ko'rsatgani uchun bir joyga chiqarildi — ikki nusxa
// vaqt o'tib bir-biridan uzilib ketmasin.

/**
 * Lug'at matni qaysi maydondan olinishi.
 *
 * Yangi darslarda so'zlar ALOHIDA "Lug'at" maydonida (`vocabText`) yoziladi.
 * Undan oldin esa ular "Mavzu" maydoniga yozilardi — bu yozilmagan qoida edi
 * va ustoz buni bilishi mumkin emasdi. Eski darslar ishlashda davom etishi
 * uchun `vocabText` bo'sh bo'lsa `topic` ga qaraladi.
 *
 * Ikkalasi birdan O'QILMAYDI: aks holda mavzu tavsifi lug'atga qo'shilib
 * ketardi.
 */
export function lessonVocabText(l: { vocabText?: string | null; topic?: string | null }): string | null {
  return l.vocabText && l.vocabText.trim() ? l.vocabText : (l.topic ?? null);
}

export interface LessonWord {
  /** Nemischa so'z */
  de: string;
  /** Tarjimasi — chiziqcha bilan yozilmagan bo'lsa null */
  uz: string | null;
}

/** Uch xil chiziqcha ham qo'llab-quvvatlanadi: - – — */
const PAIR = /^(.+?)\s+[-–—]\s+(.+)$/;

export function parseLessonWords(topic: string | null | undefined): LessonWord[] {
  const out: LessonWord[] = [];
  const seen = new Set<string>();

  for (const raw of (topic ?? "").split(/[,;\n]/)) {
    const part = raw.trim();
    if (part.length < 2) continue;

    const m = PAIR.exec(part);
    const de = (m ? m[1] : part).trim();
    const uz = m ? m[2].trim() : null;

    const key = de.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ de, uz });
  }

  return out;
}

/**
 * Mashq qilinadigan so'zlar — faqat tarjimasi borlari.
 *
 * Mashqda savol o'zbekcha beriladi ("mushuk" -> die Katze), shu sabab
 * tarjimasiz so'zni umuman so'rab bo'lmaydi.
 *
 * DIQQAT: bu funksiya SHU YERDA turishi shart. Ilgari u VocabTrainer.tsx
 * ("use client") ichida edi va lug'at sahifasi (server komponenti) uni
 * chaqirardi — Next uni ishga tushirishdan bosh tortadi:
 * "Attempted to call practicable() from the server but practicable is on
 * the client". `next build` buni TUTMAYDI, xato faqat sahifa ochilganda
 * chiqadi. Ikkala tomon ham ishlatadigan mantiq mijoz fayliga
 * qo'yilmasin.
 */
export function practicableWords(words: LessonWord[]): (LessonWord & { uz: string })[] {
  return words.filter((w): w is LessonWord & { uz: string } => !!w.uz);
}

/**
 * Mavzu maydoni LUG'ATmi yoki oddiy tavsifmi.
 *
 * O'qituvchi ba'zan u yerga darsning tavsifini gap ko'rinishida yozadi.
 * Bunday matnni lug'at qilib ko'rsatish xato bo'lardi, shu sabab: kamida
 * bitta tarjima jufti bo'lsa yoki bir nechta qisqa bo'lak bo'lsa — lug'at.
 */
export function looksLikeVocabulary(words: LessonWord[]): boolean {
  if (words.some((w) => w.uz)) return true;
  return words.length >= 3 && words.every((w) => w.de.length <= 32);
}
