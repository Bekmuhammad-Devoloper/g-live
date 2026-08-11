import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

// Bo'lim ichidagi kichik modullarga havola kartasi
export function HubCard({
  href,
  icon,
  title,
  desc,
  stat,
}: {
  href: string;
  icon: string;
  title: string;
  desc?: string;
  stat?: string | number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          {stat !== undefined && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{stat}</span>
          )}
        </div>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      <Icon name="arrow" className="mt-3 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600" />
    </Link>
  );
}

// Hali to'ldirilmagan bo'limlar uchun ogohlantirish paneli
export function ComingSoon({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900", padded && "p-5", className)}>
      {children}
    </div>
  );
}

const statTones: Record<string, { text: string; chip: string }> = {
  default: { text: "text-slate-900 dark:text-slate-100", chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" },
  brand: { text: "text-slate-900 dark:text-slate-100", chip: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" },
  green: { text: "text-emerald-600 dark:text-emerald-400", chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  red: { text: "text-red-600 dark:text-red-400", chip: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300" },
  amber: { text: "text-amber-600 dark:text-amber-400", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "green" | "red" | "amber" | "brand";
  icon?: string;
}) {
  const s = statTones[tone] ?? statTones.default;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
          <div className={cn("mt-1.5 whitespace-nowrap font-bold leading-none tracking-tight", String(value).length > 9 ? "text-[20px]" : "text-[26px]", s.text)}>{value}</div>
          {hint && <div className="mt-1.5 text-xs text-slate-400">{hint}</div>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.chip)}>
            <Icon name={icon} className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

const badgeTones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
  purple: "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30",
};

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone] ?? badgeTones.slate
      )}
    >
      {children}
    </span>
  );
}

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            {head}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <div className="text-3xl opacity-30">📭</div>
        <div className="mt-2 text-sm text-slate-400">{text}</div>
      </td>
    </tr>
  );
}

export function Forbidden({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-red-200/70 bg-red-50 p-8 text-center shadow-card dark:border-red-900/50 dark:bg-red-950/30">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
          <Icon name="shield" className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-red-800 dark:text-red-300">{title}</h2>
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{body}</p>
      </div>
    </div>
  );
}
