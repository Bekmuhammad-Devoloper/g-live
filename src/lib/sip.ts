export const SIP_EXTENSION_COUNT = 10;

export const SIP_EXTENSIONS: readonly string[] = Array.from({ length: SIP_EXTENSION_COUNT }, (_, i) => `glive${i + 1}`);

export const SIP_RANGE_LABEL = `${SIP_EXTENSIONS[0]}…${SIP_EXTENSIONS[SIP_EXTENSIONS.length - 1]}`;

export interface SipOption { ext: string; owner: string | null; ownerActive: boolean }

export function canonicalSipExtension(raw: string | null | undefined): string | null {
  const m = /^(?:glive|operator)\s*(\d+)$/i.exec(String(raw ?? "").trim());
  if (!m || Number(m[1]) < 1) return null;
  return `glive${Number(m[1])}`;
}

export function parseSipExtension(raw: string | null | undefined): string | null {
  const ext = canonicalSipExtension(raw);
  return ext && SIP_EXTENSIONS.includes(ext) ? ext : null;
}
