"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { switchTheme } from "@/lib/themeSwitch";
import { Icon } from "./Icon";

export default function ThemeToggle({ locale = "uz" }: { locale?: Locale }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = !document.documentElement.classList.contains("dark");
    const r = e.currentTarget.getBoundingClientRect();
    switchTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={dark ? tr(locale, { uz: "Yorug' rejim", ru: "Светлый режим", en: "Light mode", de: "Heller Modus" }) : tr(locale, { uz: "Tungi rejim", ru: "Тёмный режим", en: "Dark mode", de: "Dunkler Modus" })}
      aria-label={tr(locale, { uz: "Mavzu", ru: "Тема", en: "Theme", de: "Design" })}
    >
      {ready && <Icon key={dark ? "sun" : "moon"} name={dark ? "sun" : "moon"} className="gl-theme-icon h-5 w-5" />}
    </button>
  );
}
