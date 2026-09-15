"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { fin, V2_NAV } from "./_i18n";

// Finance V2 ichki navigatsiyasi (yorliqlar). Faol yorliq — yo'l prefiksi bo'yicha.
export default function V2Nav({ locale, hidden }: { locale: Locale; hidden: string[] }) {
  const path = usePathname();
  const items = V2_NAV.filter((n) => !hidden.includes(n.href));
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      {items.map((n) => {
        const active = n.href === "/finance/v2" ? path === n.href : path.startsWith(n.href) && !(n.href === "/finance/v2/salary" && path.startsWith("/finance/v2/salary/settings"));
        return (
          <Link key={n.href} href={n.href} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition", active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
            <Icon name={n.icon} className="h-4 w-4" />
            {fin(locale, n.key)}
          </Link>
        );
      })}
    </nav>
  );
}
