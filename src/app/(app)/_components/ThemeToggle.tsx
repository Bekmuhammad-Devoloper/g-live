"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { prepareThemeInk, switchTheme } from "@/lib/themeSwitch";
import { Icon } from "./Icon";

type IdleWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const centerOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export default function ThemeToggle({ locale = "uz" }: { locale?: Locale }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  useEffect(() => {
    const w = window as unknown as IdleWindow;
    let timer = 0;
    const warm = () => { if (btnRef.current) prepareThemeInk(centerOf(btnRef.current)); };
    const schedule = () => {
      if (w.requestIdleCallback) timer = w.requestIdleCallback(warm, { timeout: 4000 });
      else timer = window.setTimeout(warm, 2500);
    };
    const cancel = () => {
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(timer);
      else window.clearTimeout(timer);
    };
    let resize = 0;
    const onResize = () => {
      window.clearTimeout(resize);
      resize = window.setTimeout(() => { cancel(); schedule(); }, 600);
    };
    schedule();
    window.addEventListener("resize", onResize);
    return () => {
      cancel();
      window.clearTimeout(resize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = !document.documentElement.classList.contains("dark");
    switchTheme(next, centerOf(e.currentTarget));
    setDark(next);
  }

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={dark ? tr(locale, { uz: "Yorug' rejim", ru: "Светлый режим", en: "Light mode", de: "Heller Modus" }) : tr(locale, { uz: "Tungi rejim", ru: "Тёмный режим", en: "Dark mode", de: "Dunkler Modus" })}
      aria-label={tr(locale, { uz: "Mavzu", ru: "Тема", en: "Theme", de: "Design" })}
    >
      {ready && <Icon key={dark ? "sun" : "moon"} name={dark ? "sun" : "moon"} className="gl-theme-icon h-5 w-5" />}
    </button>
  );
}
