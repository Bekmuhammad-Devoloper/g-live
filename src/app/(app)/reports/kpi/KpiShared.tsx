"use client";

import { cn } from "@/lib/cn";
import { Icon } from "../../_components/Icon";

export type TL = { uz: string; ru: string; en: string; de?: string };

export type Cat = "operator" | "rop" | "admin";

export interface VKpiRow {
  id: string;
  name: string;
  cat: Cat;
  imageUrl?: string | null;
  total: number;
  won: number;
  blocked: number;
  opsCount: number;
  conv: number;
  kpiPct: number;
  fiksa: number;
  bonus: number;
  kpiMoney: number;
  wonMonth: number;
  earnedMonth: number;
  workDays: number;
}

export const CAT_LABEL: Record<Cat, TL> = {
  operator: { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" },
  rop: { uz: "ROP", ru: "РОП", en: "ROP", de: "ROP" },
  admin: { uz: "Admin", ru: "Админ", en: "Admin", de: "Admin" },
};

export const TABS: { key: Cat; label: TL; icon: string }[] = [
  { key: "operator", label: { uz: "Operatorlar", ru: "Операторы", en: "Operators", de: "Operatoren" }, icon: "users" },
  { key: "rop", label: { uz: "ROPlar", ru: "РОПы", en: "ROPs", de: "ROPs" }, icon: "chart" },
  { key: "admin", label: { uz: "Adminlar", ru: "Админы", en: "Admins", de: "Admins" }, icon: "shieldCheck" },
];

export const TONE: Record<Cat, { active: string; avatar: string; ring: string }> = {
  operator: {
    active: "bg-blue-600 text-white shadow-sm shadow-blue-500/25",
    avatar: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/25",
  },
  rop: {
    active: "bg-purple-600 text-white shadow-sm shadow-purple-500/25",
    avatar: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500/25",
  },
  admin: {
    active: "bg-orange-600 text-white shadow-sm shadow-orange-500/25",
    avatar: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/25",
  },
};

export const MEDAL = [
  { grad: "from-yellow-400 to-amber-500", shadow: "shadow-yellow-500/25", ring: "ring-yellow-500/30", icon: "trophy" },
  { grad: "from-slate-300 to-slate-400", shadow: "shadow-slate-400/20", ring: "ring-slate-400/20", icon: "award" },
  { grad: "from-amber-600 to-orange-700", shadow: "shadow-amber-600/20", ring: "ring-amber-600/20", icon: "award" },
];

export function kpiColor(v: number): string {
  if (v >= 80) return "#10b981";
  if (v >= 60) return "#f59e0b";
  return "#ef4444";
}

export const firstName = (n: string) => n.split(" ").filter(Boolean)[0] ?? n;

export const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const avg1 = (list: number[]) =>
  list.length ? (list.reduce((s, v) => s + v, 0) / list.length).toFixed(1) : "0";

export const CAT_ICON: Record<Cat, string> = {
  operator: "headphones",
  rop: "chart",
  admin: "shieldCheck",
};

export function Avatar({ name, cat, size = 36, imageUrl }: { name: string; cat: Cat; size?: number; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <span
        className={cn("block shrink-0 rounded-full bg-cover bg-center ring-1 ring-black/5 dark:ring-white/10", TONE[cat].ring)}
        style={{ width: size, height: size, backgroundImage: `url(${imageUrl})` }}
        title={name}
      />
    );
  }
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full", TONE[cat].avatar)}
      style={{ width: size, height: size }}
      title={name}
    >
      <Icon name={CAT_ICON[cat]} style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const m = MEDAL[rank - 1];
    return (
      <span className={cn("mx-auto grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white shadow-md", m.grad, m.shadow)}>
        <Icon name={m.icon} className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {rank}
    </span>
  );
}

export function PanelHead({ icon, iconClass, title, sub }: { icon: string; iconClass: string; title: string; sub: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", iconClass)}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        <p className="truncate text-[11px] text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
