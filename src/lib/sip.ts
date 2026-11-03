export const DEFAULT_SIP_COUNT = 10;

export interface SipOption { ext: string; owner: string | null; ownerActive: boolean }

export function canonicalSipExtension(raw: string | null | undefined): string | null {
  const m = /^(?:glive|operator)\s*(\d+)$/i.exec(String(raw ?? "").trim());
  if (!m || Number(m[1]) < 1) return null;
  return `glive${Number(m[1])}`;
}

export function sipRangeLabel(exts: readonly string[]): string {
  return exts.length ? `${exts[0]}…${exts[exts.length - 1]}` : "—";
}
