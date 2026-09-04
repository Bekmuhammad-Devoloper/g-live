"use client";

import Link from "next/link";
import type { StudentStrings } from "./_i18n";
import { usePathname } from "next/navigation";

const TEAL = "#0e7490";
const GRAY = "#94a3b8";

// Pastki yorliqlar: Start (uy) · Kurse (kitob) · Üben (nishon+o'q) · Profil (odam).
// Hammasi bir xil o'lchamda (26px), bir xil chiziq qalinligida (2) va bir xil
// optik og'irlikda chizilgan; faol yorliq to'ldirilgan va rangli, ostida chiziqcha.
function Ico({ name, active }: { name: string; active: boolean }) {
  const c = active ? TEAL : GRAY;
  const p = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "home") {
    return (
      <svg {...p} fill={active ? c : "none"}>
        <path d="M4 10.7 12 4.2l8 6.5V19a1.2 1.2 0 0 1-1.2 1.2h-3.9v-5.6h-5.8v5.6H5.2A1.2 1.2 0 0 1 4 19v-8.3Z" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg {...p}>
        <path d="M12 6.4c-1.4-1.5-3.4-2.1-5.7-2.1-.95 0-1.9.14-2.85.43V18.6c.95-.29 1.9-.43 2.85-.43 2.3 0 4.3.6 5.7 2.1 1.4-1.5 3.4-2.1 5.7-2.1.95 0 1.9.14 2.85.43V4.73c-.95-.29-1.9-.43-2.85-.43-2.3 0-4.3.6-5.7 2.1Z" />
        <path d="M12 6.4v13.87" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...p}>
        <circle cx="11.4" cy="12.6" r="8" />
        <circle cx="11.4" cy="12.6" r="4.3" />
        <circle cx="11.4" cy="12.6" r="1.3" fill={c} stroke="none" />
        <path d="m11.4 12.6 8.2-8.2" />
        <path d="M16.9 4.4h2.9v2.9" />
      </svg>
    );
  }
  // Profil
  return (
    <svg {...p}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.8 20c.9-3.7 3.9-5.7 7.2-5.7s6.3 2 7.2 5.7" />
    </svg>
  );
}

export default function BottomNav({ t, showUben = true }: { t: StudentStrings; showUben?: boolean }) {
  const pathname = usePathname();
  // Jang, yozishma va bog'lanishlar grafi to'liq ekranda ochiladi — menyu ko'rinmaydi
  if (
    pathname.startsWith("/student/battle") ||
    pathname.startsWith("/student/lehrer") ||
    pathname.startsWith("/student/gehirn/graph")
  ) return null;

  // Barcha tablar /student/* ichida — o'quvchi endi xodim (AppShell) sahifalariga chiqib ketmaydi
  const items = [
    { href: "/student", icon: "home", label: t.navStart, exact: true },
    { href: "/student/kurse", icon: "book", label: t.navCourses },
    // Mashqlar bo'limi menejer tomonidan o'chirilgan bo'lishi mumkin
    ...(showUben ? [{ href: "/student/uben", icon: "target", label: t.navPractice }] : []),
    { href: "/student/profil", icon: "profil", label: t.navProfile },
  ];
  return (
    <nav className="gl-glass-nav fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-[26px] px-3 pt-2.5 pb-[calc(8px+env(safe-area-inset-bottom))]">
      <div className="flex items-stretch justify-around">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <Link key={it.label} href={it.href} aria-current={active ? "page" : undefined} className="flex flex-1 flex-col items-center gap-1 px-1 py-1">
              <Ico name={it.icon} active={active} />
              <span className="text-[12.5px] font-semibold leading-none" style={{ color: active ? TEAL : GRAY }}>
                {it.label}
              </span>
              {/* faol yorliq ostidagi chiziqcha (maketdagidek) */}
              <span className="h-[3px] w-6 rounded-full" style={{ background: active ? TEAL : "transparent" }} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
