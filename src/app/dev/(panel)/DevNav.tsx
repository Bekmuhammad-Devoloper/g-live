"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dev", label: "Bosh sahifa", exact: true },
  { href: "/dev/centers/new", label: "Yangi markaz" },
  { href: "/dev/audit", label: "Amallar jurnali" },
];

export default function DevNav() {
  const path = usePathname();
  return (
    <nav className="space-y-1 p-3">
      {ITEMS.map((it) => {
        const on = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${on ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
