export type QType = "text" | "choice";

export interface ApplyQuestion {
  q: string;
  type: QType;
  options?: string[];
  required?: boolean;
}

export const MAX_QUESTIONS = 10;
export const MAX_OPTIONS = 8;

export function parseQuestions(raw: string | null | undefined): ApplyQuestion[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const out: ApplyQuestion[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const q = String(o.q ?? "").trim();
    if (!q) continue;
    const type: QType = o.type === "choice" ? "choice" : "text";
    const options =
      type === "choice" && Array.isArray(o.options)
        ? o.options.map((x) => String(x).trim()).filter(Boolean).slice(0, MAX_OPTIONS)
        : undefined;
    if (type === "choice" && (!options || options.length === 0)) {
      out.push({ q, type: "text", required: !!o.required });
    } else {
      out.push({ q, type, options, required: !!o.required });
    }
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

export function serializeQuestions(list: ApplyQuestion[]): string | null {
  const clean = parseQuestions(JSON.stringify(list));
  return clean.length ? JSON.stringify(clean) : null;
}
