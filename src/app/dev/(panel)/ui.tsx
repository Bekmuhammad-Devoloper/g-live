// Dev panel uchun kichik umumiy UI bo'laklari (server va klientda ishlaydi)

export function fmtBytes(n: number): string {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

export function fmtMoney(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Litsenziya tugashiga qolgan kunlar (bugun tugasa 0, o'tib ketgan bo'lsa manfiy) */
export function daysLeft(until: string | null | undefined): number | null {
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return null;
  const end = new Date(until + "T23:59:59").getTime();
  return Math.floor((end - Date.now()) / 86_400_000);
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#0d1424] ${className}`}>{children}</div>;
}

/** Belgi: SVG path (24×24, chiziqli) */
export const ICONS = {
  building: "M4 21V7l8-4 8 4v14M9 21v-6h6v6",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  money: "M3 7h18v10H3zM7 12h.01M17 12h.01M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  lead: "M12 3v12M7 10l5 5 5-5M5 21h14",
  layers: "M12 3l9 5-9 5-9-5 9-5M3 13l9 5 9-5",
  cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  disk: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
} as const;

export function Stat({ label, value, hint, tone = "slate", icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue"; icon?: keyof typeof ICONS }) {
  const c = { slate: "text-white", green: "text-emerald-400", amber: "text-amber-400", red: "text-red-400", blue: "text-sky-400" }[tone];
  return (
    <Card className="relative h-full overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/40 to-transparent" />
      {icon && (
        <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e3262b]/20 to-[#f6b51e]/10 text-orange-300 ring-1 ring-orange-400/20">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
        </span>
      )}
      <div className="pr-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${c}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}

export function Pill({ tone, children }: { tone: "green" | "amber" | "red" | "slate" | "blue"; children: React.ReactNode }) {
  const c = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
    slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    blue: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c}`}>{children}</span>;
}

export function LicensePill({ until, suspended }: { until: string | null; suspended?: boolean }) {
  if (suspended) return <Pill tone="red">To'xtatilgan</Pill>;
  const d = daysLeft(until);
  if (d === null) return <Pill tone="slate">Muddatsiz</Pill>;
  if (d < 0) return <Pill tone="red">Muddati o'tgan</Pill>;
  if (d <= 14) return <Pill tone="amber">{d} kun qoldi</Pill>;
  return <Pill tone="green">{d} kun</Pill>;
}

/** Davomiylik: 3 kun 4 soat / 2 soat 15 daq / 40 daq */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} kun ${h} soat`;
  if (h > 0) return `${h} soat ${m} daq`;
  return `${m} daq`;
}

/** Sana va vaqt (Toshkent) */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Foiz chizig'i: 70% dan sariq, 85% dan qizil */
export function Bar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, pct));
  const c = v > 85 ? "from-red-500 to-red-400" : v > 70 ? "from-amber-500 to-amber-400" : "from-[#e3262b] via-[#ee7a24] to-[#f6b51e]";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full bg-gradient-to-r ${c}`} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Kartaning o'ng yuqori burchagidagi belgi (Stat ishlatilmagan kartalar uchun) */
export function IconChip({ icon }: { icon: keyof typeof ICONS }) {
  return (
    <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e3262b]/20 to-[#f6b51e]/10 text-orange-300 ring-1 ring-orange-400/20">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
    </span>
  );
}
