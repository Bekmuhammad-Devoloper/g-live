export const UZ_LOCAL_LEN = 9;
export const UZ_FULL_LEN = 12;

export function fmtUzPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length >= UZ_FULL_LEN && d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, UZ_LOCAL_LEN);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

export function parseUzPhone(raw: string): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === UZ_FULL_LEN && d.startsWith("998")) d = d.slice(3);
  if (d.length === UZ_LOCAL_LEN + 1 && (d.startsWith("0") || d.startsWith("8"))) d = d.slice(1);
  if (d.length !== UZ_LOCAL_LEN) return null;
  if (!/^[2-9]/.test(d)) return null;
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}
