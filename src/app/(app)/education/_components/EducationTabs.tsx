"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "../../_components/Icon";

export interface EduTab {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export default function EducationTabs({ tabs }: { tabs: EduTab[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto">
      <nav className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Icon name={tab.icon} className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
