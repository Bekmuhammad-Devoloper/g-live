// Kurslar bo'limi uchun umumiy util va turlar.

export const COURSE_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1", "#ef4444"];

// Har bir kurs id'siga barqaror (deterministik) rang — grid va detal sahifada bir xil chiqadi.
export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COURSE_COLORS[h % COURSE_COLORS.length];
}

export const LESSON_DURATIONS = ["45 daqiqa", "60 daqiqa", "80 daqiqa", "90 daqiqa", "120 daqiqa"];

export const META_KEY = "gl:course-meta";

export interface CourseMeta {
  code?: string;
  lessonDuration?: string;
  months?: number;
  price?: number;
}

export function loadMeta(): Record<string, CourseMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CourseMeta>) : {};
  } catch {
    return {};
  }
}

export function saveMetaFor(id: string, m: CourseMeta): Record<string, CourseMeta> {
  const all = loadMeta();
  all[id] = m;
  try { localStorage.setItem(META_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all;
}
