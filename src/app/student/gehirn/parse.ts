// "Ikkinchi miya" matnini tahlil qilish — Obsidian sintaksisi.
//
// Bu fayl ATAYLAB toza: prisma/server importi yo'q, shuning uchun uni
// server sahifa ham, client komponent ham (tahrirlagich, graf) ishlatadi.

/** Yozuv turlari — grafda rang va ikonka shu bo'yicha beriladi. */
export const NOTE_KINDS = ["NOTE", "IDEA", "GOAL", "BOOK", "PERSON", "DAILY"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const KIND_COLOR: Record<string, string> = {
  NOTE: "#0e7490",   // feruza — oddiy yozuv
  IDEA: "#f59e0b",   // sariq — g'oya
  GOAL: "#10b981",   // yashil — maqsad
  BOOK: "#8b5cf6",   // binafsha — kitob/manba
  PERSON: "#ec4899", // pushti — inson
  DAILY: "#3b82f6",  // ko'k — kundalik
};

export const kindColor = (k: string) => KIND_COLOR[k] ?? KIND_COLOR.NOTE;

/**
 * Matndagi [[Havolalar]]ni topadi.
 * `[[Sarlavha|ko'rinadigan matn]]` shakli ham qo'llanadi (Obsidian kabi).
 */
export function parseLinks(content: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\[\[([^\][|]+?)(?:\|[^\][]*?)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const title = m[1].trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/**
 * Matndagi #teglarni topadi.
 * Faqat qator boshi yoki bo'shliqdan keyingi # hisoblanadi — shunda
 * "C#" yoki "https://x/#y" kabi joylar teg bo'lib qolmaydi.
 */
export function parseTags(content: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(^|\s)#([\p{L}\p{N}_-]{2,32})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const tag = m[2];
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Vergul bilan yozilgan teglar maydonini ro'yxatga aylantiradi. */
export function splitTags(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim().replace(/^#/, ""))
    .filter(Boolean);
}

/** Yozuvning barcha teglari: alohida maydon + matndan yig'ilganlari. */
export function allTags(note: { tags?: string | null; content: string }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...splitTags(note.tags), ...parseTags(note.content)]) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Sarlavhani havola uchun solishtirish kaliti (registr va bo'shliqqa bog'liq emas). */
export const linkKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

export interface GraphNote {
  id: string;
  title: string;
  content: string;
  kind: string;
}

export interface BuiltGraph {
  nodes: { id: string; title: string; kind: string; deg: number; missing: boolean }[];
  links: { source: string; target: string }[];
}

/**
 * Yozuvlar ro'yxatidan graf quradi.
 * Hali yaratilmagan sarlavhaga havola ham tugun bo'ladi ("missing") —
 * Obsidian'da ham shunday: bosilganda o'sha nomdagi yozuv yaratiladi.
 */
export function buildGraph(notes: GraphNote[]): BuiltGraph {
  const byKey = new Map<string, GraphNote>();
  for (const n of notes) byKey.set(linkKey(n.title), n);

  const nodes = new Map<string, { id: string; title: string; kind: string; deg: number; missing: boolean }>();
  for (const n of notes) nodes.set(n.id, { id: n.id, title: n.title, kind: n.kind, deg: 0, missing: false });

  const links: { source: string; target: string }[] = [];
  const pairSeen = new Set<string>();

  for (const n of notes) {
    for (const raw of parseLinks(n.content)) {
      const key = linkKey(raw);
      const target = byKey.get(key);
      // Mavjud bo'lmagan sarlavha — "yo'q" tugun (id sifatida kalitning o'zi)
      const targetId = target ? target.id : `missing:${key}`;
      if (targetId === n.id) continue; // o'ziga havola hisobga olinmaydi
      if (!target && !nodes.has(targetId)) {
        nodes.set(targetId, { id: targetId, title: raw, kind: "NOTE", deg: 0, missing: true });
      }
      const pair = n.id < targetId ? `${n.id}|${targetId}` : `${targetId}|${n.id}`;
      if (pairSeen.has(pair)) continue;
      pairSeen.add(pair);
      links.push({ source: n.id, target: targetId });
      const a = nodes.get(n.id);
      const b = nodes.get(targetId);
      if (a) a.deg++;
      if (b) b.deg++;
    }
  }

  return { nodes: [...nodes.values()], links };
}

/** Ushbu yozuvga havola qilgan yozuvlar (backlinks). */
export function backlinksOf(target: { id: string; title: string }, notes: GraphNote[]) {
  const key = linkKey(target.title);
  return notes.filter((n) => n.id !== target.id && parseLinks(n.content).some((l) => linkKey(l) === key));
}
