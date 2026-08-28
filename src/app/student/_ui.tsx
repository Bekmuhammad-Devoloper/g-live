import Link from "next/link";

// O'quvchi portalining UMUMIY dizayn elementlari — Start ekrani (page.tsx)
// uslubidan olingan. Barcha ichki sahifalar (Kurse, Üben, Profil,
// Mitteilungen) shu yerdan oladi, shunda ko'rinish bir xil qoladi.

export const TEAL = "#0e7490"; // asosiy rang (maketdagi to'q moviy-feruza)
export const NAVY = "#134e5e"; // halqa/qiymatlarning to'q varianti

// Yumshoq oq karta (Start ekranidagi bilan bir xil)
export const CARD =
  "rounded-[26px] bg-white/85 shadow-[0_12px_28px_rgba(19,78,94,0.10),inset_0_1px_0_rgba(255,255,255,0.9)]";

// Ochiq feruza gradient (Dein Fortschritt kartasi foni)
export const SOFT_GRADIENT = "linear-gradient(135deg, #cfe7f0 0%, #e7f3f8 55%, #f2f9fc 100%)";
// To'q feruza gradient (reklama banneri foni)
export const DEEP_GRADIENT = "linear-gradient(105deg, #0c6a86 0%, #1590b3 45%, #7fd0e6 100%)";
// Ikonka doirasi gradienti
export const ICON_GRADIENT = `linear-gradient(135deg, #17a2bf, ${TEAL})`;

export const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
};

export const fmtSum = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} so'm`;

// ── Halqali foiz (progress ring) ──
export function Ring({ pct, size = 64, stroke = 5.5, color = NAVY }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="#dce9f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)}
      />
    </svg>
  );
}

// ── Doira shaklidagi Germaniya bayrog'i (rasm qo'yilmagan avatar uchun) ──
export function FlagAvatar({ s = 44, id = "glUiAvatarClip" }: { s?: number; id?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" className="shrink-0">
      <defs>
        <clipPath id={id}><circle cx="22" cy="22" r="22" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="44" height="14.67" fill="#111111" />
        <rect x="0" y="14.67" width="44" height="14.67" fill="#DD0000" />
        <rect x="0" y="29.34" width="44" height="14.66" fill="#FFCE00" />
      </g>
      <circle cx="22" cy="22" r="21.25" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
    </svg>
  );
}

// ── Ichki sahifa sarlavhasi: orqaga tugma + katta sarlavha ──
export function PageHeader({ title, subtitle, back = "/student", right }: { title: string; subtitle?: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Link
        href={back}
        aria-label="Zurück"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5.5 8.5 12l6.5 6.5" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Gradient doirali kichik ikonka (Münzen kartalaridagi kabi) ──
export function IconBadge({ children, s = 44 }: { children: React.ReactNode; s?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full shadow-[0_8px_16px_rgba(14,116,144,0.3)]"
      style={{ width: s, height: s, background: ICON_GRADIENT }}
    >
      {children}
    </span>
  );
}

// ── Bo'lim sarlavhasi ──
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-1 text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>{children}</div>;
}

// ── Holat belgisi (pill) ──
export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const map = {
    ok: { color: "#047857", bg: "#d1fae5" },
    warn: { color: "#b45309", bg: "#fef3c7" },
    bad: { color: "#b91c1c", bg: "#fee2e2" },
    muted: { color: "#475569", bg: "#e2e8f0" },
  } as const;
  const t = map[tone];
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: t.color, background: t.bg }}>
      {children}
    </span>
  );
}

// ── Chiziqli SVG ikonkalar (Start ekrani uslubida, strokeWidth=2) ──
const sw = 2;
type IcoProps = { c?: string; s?: number };

export function IcoBook({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-1.5-1.6-3.6-2.2-6-2.2-1 0-2 .15-3 .45V19c1-.3 2-.45 3-.45 2.4 0 4.5.6 6 2.2 1.5-1.6 3.6-2.2 6-2.2 1 0 2 .15 3 .45V4.25c-1-.3-2-.45-3-.45-2.4 0-4.5.6-6 2.2Z" />
      <path d="M12 6v14.75" />
    </svg>
  );
}
export function IcoPlay({ c = "white", s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M8.2 5.5v13l10.4-6.5-10.4-6.5Z" fill={c} />
    </svg>
  );
}
export function IcoCheck({ c = "white", s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
export function IcoLock({ c = "#94a3b8", s = 22 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}
export function IcoTarget({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill={c} stroke="none" />
    </svg>
  );
}
export function IcoCalendar({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M8.5 2.8V7M15.5 2.8V7" />
    </svg>
  );
}
export function IcoClock({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </svg>
  );
}
export function IcoTeacher({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M5 20.5c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" />
    </svg>
  );
}
export function IcoPin({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
export function IcoWallet({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="15" r="1.4" fill={c} stroke="none" />
    </svg>
  );
}
export function IcoDoc({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 12.5h6M9 16h6" />
    </svg>
  );
}
export function IcoTrophy({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H4.5v1.7A3.3 3.3 0 0 0 8 10.5M16 5.5h3.5v1.7a3.3 3.3 0 0 1-3.5 3.3" />
      <path d="M12 14v3.5M8.5 20.5h7M10 17.5h4" />
    </svg>
  );
}
export function IcoBell({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
export function IcoKey({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14.5" r="4.5" />
      <path d="M11.2 11.3 20 2.5M15.5 7l2.6 2.6M12.9 9.6l2.6 2.6" />
    </svg>
  );
}
export function IcoLogout({ c = "#b91c1c", s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h7.5" />
      <path d="M16 8l4 4-4 4M20 12H10" />
    </svg>
  );
}
export function IcoDownload({ c = TEAL, s = 24 }: IcoProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v10.5M7.5 11 12 15.5 16.5 11" />
      <path d="M5 19.5h14" />
    </svg>
  );
}

// ── Davomat: qaysi status "qatnashdi" hisoblanadi ──
// Admin tomonidagi kanonik formula bilan bir xil (reports/attendance):
// PRESENT, LATE, ONLINE va MAKEUP — barchasi qatnashuv.
// Start va Profil sahifalari SHU funksiyani ishlatadi — raqamlar farq qilmasin.
export const ATTENDED = new Set(["PRESENT", "LATE", "ONLINE", "MAKEUP"]);
export const isAttended = (status: string) => ATTENDED.has(status);

// ── URL himoyasi: faqat http(s) va nisbiy yo'llar ──
// onlineLink/material URL lari bazadan keladi — javascript: kabi sxemalar kesiladi.
export function safeUrl(u: string | null | undefined): string | null {
  const v = (u ?? "").trim();
  if (!v) return null;
  if (v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
  return null;
}
