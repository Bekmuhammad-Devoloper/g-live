export function lessonVocabText(l: { vocabText?: string | null; topic?: string | null }): string | null {
  return l.vocabText && l.vocabText.trim() ? l.vocabText : (l.topic ?? null);
}

export interface LessonWord {
  de: string;
  uz: string | null;
}

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

export function splitArticle(de: string): { article: string | null; rest: string } {
  const m = /^(der|die|das)\s+(.+)$/i.exec(de.trim());
  if (!m) return { article: null, rest: de.trim() };
  return { article: m[1].toLowerCase(), rest: m[2] };
}

export function practicableWords(words: LessonWord[]): (LessonWord & { uz: string })[] {
  return words.filter((w): w is LessonWord & { uz: string } => !!w.uz);
}

export function looksLikeVocabulary(words: LessonWord[]): boolean {
  if (words.some((w) => w.uz)) return true;
  return words.length >= 3 && words.every((w) => w.de.length <= 32);
}
