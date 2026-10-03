// Filialning ochiq ariza formasidagi kurslar ro'yxati (Branch.applyCourses — JSON).
// Filial tanlangach ariza beruvchi shu kurslardan birini tanlaydi; til kurslarida
// (levels=true) daraja so'raladi, qolganlarida (Matematika, Pochemushka...) so'ralmaydi.
// Ro'yxat bo'sh bo'lsa forma avvalgidek — kurs so'ralmaydi, daraja so'raladi.

export interface ApplyCourse {
  name: string;
  /** Daraja (A1–B2) so'ralsinmi — til kurslari uchun */
  levels: boolean;
}

export const MAX_APPLY_COURSES = 30;

export function parseApplyCourses(raw: string | null | undefined): ApplyCourse[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: ApplyCourse[] = [];
    for (const x of arr) {
      if (!x || typeof x !== "object") continue;
      const name = String((x as { name?: unknown }).name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (!name || out.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
      out.push({ name, levels: Boolean((x as { levels?: unknown }).levels) });
      if (out.length >= MAX_APPLY_COURSES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export const serializeApplyCourses = (list: ApplyCourse[]): string | null => (list.length ? JSON.stringify(list) : null);

/** Yangi qator uchun taxmin: nomida "til"/IELTS/CEFR bo'lsa — daraja so'raladi */
export const guessHasLevels = (name: string): boolean => /\btil|ielts|cefr|deutsch|english|sprach/i.test(name);
