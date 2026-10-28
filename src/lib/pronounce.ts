import { splitArticle } from "./lessonWords";

const ARTICLES = new Set([
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
]);

export function normalizeSpeech(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`´()[\]{}…—–\-_/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

export function foldUmlauts(s: string): string {
  return s
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const tolerance = (len: number) => (len >= 8 ? 2 : 1);

export interface PronounceResult {
  ok: boolean;
  target: string;
  matched: string | null;
}

export function checkPronunciation(
  targetDe: string,
  transcript: string,
  others: string[] = [],
): PronounceResult {
  const target = normalizeSpeech(splitArticle(targetDe).rest);
  const said = normalizeSpeech(transcript);
  if (!target || !said) return { ok: false, target, matched: null };

  const goal = foldUmlauts(target);

  const rivals = new Set(
    others
      .map((w) => foldUmlauts(normalizeSpeech(splitArticle(w).rest)))
      .filter((w) => w && w !== goal),
  );

  const tokens = said.split(" ").filter((w) => w && !ARTICLES.has(w));
  const candidates = [said.replace(/\s+/g, ""), ...tokens];

  const tol = tolerance(goal.length);
  let best: { word: string; folded: string; d: number } | null = null;

  for (const c of candidates) {
    if (!c) continue;
    const folded = foldUmlauts(c);
    const d = editDistance(folded, goal);
    if (!best || d < best.d) best = { word: c, folded, d };
  }
  if (!best) return { ok: false, target, matched: null };

  const saidARival = candidates.some((c) => rivals.has(foldUmlauts(c)));

  const sameStart = best.folded.charAt(0) === goal.charAt(0);

  return {
    ok: best.d === 0 || (!saidARival && sameStart && best.d <= tol),
    target,
    matched: best.word || null,
  };
}
