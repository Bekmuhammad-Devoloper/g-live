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
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint, tone = "slate" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const c = { slate: "text-slate-900 dark:text-white", green: "text-emerald-600", amber: "text-amber-600", red: "text-red-600", blue: "text-sky-600" }[tone];
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
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
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c}`}>{children}</span>;
}

export function LicensePill({ until, suspended }: { until: string | null; suspended?: boolean }) {
  if (suspended) return <Pill tone="red">To'xtatilgan</Pill>;
  const d = daysLeft(until);
  if (d === null) return <Pill tone="slate">Muddatsiz</Pill>;
  if (d < 0) return <Pill tone="red">Muddati o'tgan</Pill>;
  if (d <= 14) return <Pill tone="amber">{d} kun qoldi</Pill>;
  return <Pill tone="green">{d} kun</Pill>;
}
