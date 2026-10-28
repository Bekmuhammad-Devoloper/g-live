export const NOTE_KINDS = ["NOTE", "IDEA", "GOAL", "BOOK", "PERSON", "DAILY"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const KIND_COLOR: Record<string, string> = {
  NOTE: "#0e7490",
  IDEA: "#f59e0b",
  GOAL: "#10b981",
  BOOK: "#8b5cf6",
  PERSON: "#ec4899",
  DAILY: "#3b82f6",
};

export const kindColor = (k: string) => KIND_COLOR[k] ?? KIND_COLOR.NOTE;

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

export function splitTags(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim().replace(/^#/, ""))
    .filter(Boolean);
}

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
      const targetId = target ? target.id : `missing:${key}`;
      if (targetId === n.id) continue;
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

export function backlinksOf(target: { id: string; title: string }, notes: GraphNote[]) {
  const key = linkKey(target.title);
  return notes.filter((n) => n.id !== target.id && parseLinks(n.content).some((l) => linkKey(l) === key));
}
