"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TEAL = "#0e7490";

// Maketdagi pastki yorliqlar: Start (uy) · Kurse (kitob) · Üben (nishon) · Profil (odam)
function Ico({ name, active }: { name: string; active: boolean }) {
  const c = active ? TEAL : "#94a3b8";
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") {
    return active ? (
      <svg {...common} fill={c} stroke={c}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" /></svg>
    ) : (
      <svg {...common} fill="none" stroke={c}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" /></svg>
    );
  }
  if (name === "book") {
    return (
      <svg {...common} fill="none" stroke={c}>
        <path d="M12 6c-1.5-1.6-3.6-2.2-6-2.2-1 0-2 .15-3 .45V19c1-.3 2-.45 3-.45 2.4 0 4.5.6 6 2.2 1.5-1.6 3.6-2.2 6-2.2 1 0 2 .15 3 .45V4.25c-1-.3-2-.45-3-.45-2.4 0-4.5.6-6 2.2Z" />
        <path d="M12 6v14.75" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...common} fill="none" stroke={c}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.6" fill={c} stroke="none" />
      </svg>
    );
  }
  // profil
  return (
    <svg {...common} fill="none" stroke={c}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" />
    </svg>
  );
}

export default function BottomNav({ kurseHref }: { kurseHref: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/student", icon: "home", label: "Start", exact: true },
    { href: kurseHref, icon: "book", label: "Kurse" },
    { href: "/homework", icon: "target", label: "Üben" },
    { href: "/profile", icon: "profil", label: "Profil" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-[22px] bg-white px-4 pb-5 pt-2.5 shadow-[0_-10px_30px_rgba(19,78,94,0.14)]">
      <div className="flex items-center justify-around">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <Link key={it.label} href={it.href} className="flex flex-col items-center gap-1 px-4 py-1">
              <Ico name={it.icon} active={active} />
              <span className="text-[12px] font-semibold" style={{ color: active ? TEAL : "#94a3b8" }}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
