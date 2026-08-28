"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../(app)/_components/Icon";

// Pastki yorliqlar paneli (maketdagi Start · Kurse · Üben · Profil)
export default function BottomNav({ kurseHref }: { kurseHref: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/student", icon: "home", label: "Start", exact: true },
    { href: kurseHref, icon: "book", label: "Kurse" },
    { href: "/homework", icon: "clipboard", label: "Üben" },
    { href: "/profile", icon: "user", label: "Profil" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-3xl border-t border-white/60 bg-white/90 px-6 pb-4 pt-2 shadow-[0_-8px_30px_rgba(14,116,144,0.12)] backdrop-blur">
      <div className="flex items-center justify-between">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <Link key={it.label} href={it.href} className="flex flex-col items-center gap-0.5 px-3 py-1.5">
              <Icon name={it.icon} className={`h-6 w-6 ${active ? "text-cyan-700" : "text-slate-400"}`} />
              <span className={`text-[11px] font-semibold ${active ? "text-cyan-700" : "text-slate-400"}`}>{it.label}</span>
              {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-cyan-700" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
