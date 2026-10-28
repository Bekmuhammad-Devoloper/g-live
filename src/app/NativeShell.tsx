"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const HOME = "/student";

export default function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      document.documentElement.classList.add("gl-app");

      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0b3c4d" });

        const info = await StatusBar.getInfo();
        if (info?.height && info.height > 0) {
          document.documentElement.style.setProperty("--gl-safe-top", `${info.height}px`);
        }
      } catch {
      }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
      }

      const onClick = (e: MouseEvent) => {
        const el = (e.target as HTMLElement | null)?.closest?.("a");
        if (!el) return;
        const href = el.getAttribute("href");
        if (!href || href.startsWith("#")) return;

        let url: URL;
        try {
          url = new URL(href, window.location.href);
        } catch {
          return;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        if (url.host === window.location.host) return;

        e.preventDefault();
        import("@capacitor/browser").then(({ Browser }) =>
          Browser.open({ url: url.href, presentationStyle: "popover" }),
        );
      };
      document.addEventListener("click", onClick, true);
      cleanups.push(() => document.removeEventListener("click", onClick, true));

      const { App } = await import("@capacitor/app");
      const urlSub = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.host === window.location.host) router.push(u.pathname + u.search);
        } catch {
        }
      });
      cleanups.push(() => void urlSub.remove());
    })();

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;
    let exitArmed = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && pathname !== HOME) {
          window.history.back();
          return;
        }
        if (pathname !== HOME) {
          router.push(HOME);
          return;
        }

        if (exitArmed) {
          void App.exitApp();
          return;
        }
        exitArmed = true;
        showExitHint();
        exitTimer = setTimeout(() => { exitArmed = false; }, 2000);
      });
      remove = () => void sub.remove();
    })();

    return () => {
      cancelled = true;
      if (exitTimer) clearTimeout(exitTimer);
      remove?.();
    };
  }, [pathname, router]);

  return null;
}

function showExitHint() {
  const ID = "gl-exit-hint";
  if (document.getElementById(ID)) return;

  const el = document.createElement("div");
  el.id = ID;
  el.textContent = "Chiqish uchun yana bir marta bosing";
  el.setAttribute("role", "status");
  el.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:calc(96px + env(safe-area-inset-bottom))",
    "transform:translateX(-50%)",
    "z-index:9999",
    "padding:11px 20px",
    "border-radius:999px",
    "background:rgba(11,60,77,0.94)",
    "color:#fff",
    "font-size:13.5px",
    "font-weight:600",
    "white-space:nowrap",
    "pointer-events:none",
    "box-shadow:0 10px 28px rgba(0,0,0,0.28)",
    "opacity:0",
    "transition:opacity 150ms ease",
  ].join(";");

  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 1800);
}
