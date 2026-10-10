"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dev", label: "Bosh sahifa", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10", exact: true },
  { href: "/dev/centers/new", label: "Yangi markaz", icon: "M12 5v14M5 12h14" },
  { href: "/dev/audit", label: "Amallar jurnali", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
];

export default function DevNav() {
  const path = usePathname();
  return (
    <nav className="space-y-1 p-3">
      {ITEMS.map((it) => {
        const on = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-gradient-to-r from-[#e3262b]/15 via-[#ee7a24]/10 to-transparent text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
          >
            {on && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#e3262b] to-[#f6b51e]" />}
            <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${on ? "text-orange-300" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
