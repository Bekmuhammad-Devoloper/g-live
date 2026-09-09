"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

export default function ThemeToggle({ locale = "uz" }: { locale?: Locale }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    try {
      localStorage.setItem("gl-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={dark ? tr(locale, { uz: "Yorug' rejim", ru: "Светлый режим", en: "Light mode", de: "Heller Modus" }) : tr(locale, { uz: "Tungi rejim", ru: "Тёмный режим", en: "Dark mode", de: "Dunkler Modus" })}
      aria-label={tr(locale, { uz: "Mavzu", ru: "Тема", en: "Theme", de: "Design" })}
    >
      {/* Miltillashning oldini olish uchun ready bo'lgunча ko'rsatmaymiz */}
      {ready && <Icon name={dark ? "sun" : "moon"} className="h-5 w-5" />}
    </button>
  );
}
