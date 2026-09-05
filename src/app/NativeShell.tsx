"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Android ilovasining "native" qatlami.
//
// Sayt brauzerda ham, Capacitor ilovasi ichida ham ayni shu kod bilan
// ishlaydi. Quyidagilarning HAMMASI faqat ilova ichida yoqiladi — brauzerda
// bu komponent hech narsa qilmaydi (Capacitor topilmasa jim chiqib ketadi).
//
//   · ochilish ekranini (splash) sayt tayyor bo'lgach yopish
//   · holat qatorini (status bar) ilova rangiga bo'yash
//   · telefonning "orqaga" tugmasi ilovadagidek ishlashi
//   · tashqi havolalarni tizim brauzerida ochish
//   · germaniya.live havolasi bosilganda ilova ichida to'g'ri sahifaga o'tish
//
// Modullar ATAYLAB dinamik import qilinadi: brauzerda ular umuman
// yuklanmaydi va sahifa og'irlashmaydi.

const HOME = "/student";

export default function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();

  // ── 1. Ilovaga xos sozlashlar (bir marta) ──
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;

      // CSS shu belgiga qarab ilovaga xos qoidalarni yoqadi
      document.documentElement.classList.add("gl-app");

      // ── Holat qatori (soat, batareya turadigan tepa qator) ──
      //
      // Android 15 dan boshlab ilova MAJBURAN butun ekranga, holat qatori
      // ostiga ham chiziladi — buni o'chirib bo'lmaydi. CSS dagi
      // `env(safe-area-inset-top)` esa Android'da ko'pincha 0 qaytaradi:
      // u faqat ekran kesigini (notch) hisoblaydi, oddiy holat qatorini
      // emas. Natijada sarlavha soatga taqalib qolardi.
      //
      // Shu sabab balandlikni Capacitor'dan SO'RAYMIZ va uni CSS
      // o'zgaruvchisiga yozamiz — maket o'shanga tayanadi.
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0b3c4d" });

        const info = await StatusBar.getInfo();
        // Balandlik dp da keladi, WebView'da bu CSS piksel bilan bir xil
        if (info?.height && info.height > 0) {
          document.documentElement.style.setProperty("--gl-safe-top", `${info.height}px`);
        }
      } catch {
        // Ba'zi qurilmalarda holat qatorini boshqarib bo'lmaydi —
        // maket `env(safe-area-inset-top)` ga qaytadi
      }

      // Sahifa chizilgach ochilish ekranini yopamiz. Avtomatik yopilish ham
      // bor (3 s), lekin sayt tezroq kelsa kutib o'tirishning hojati yo'q.
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        /* splash yo'q bo'lsa ham davom etaveradi */
      }

      // ── Tashqi havolalar tizim brauzerida ochilsin ──
      // Ilova ichida boshqa saytga o'tib ketilsa, u yerdan qaytish yo'li
      // qolmaydi va o'quvchi "ilova qotdi" deb o'ylaydi.
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

      // ── germaniya.live havolasi ilovada ochilganda ──
      const { App } = await import("@capacitor/app");
      const urlSub = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.host === window.location.host) router.push(u.pathname + u.search);
        } catch {
          /* noto'g'ri havola — e'tiborsiz */
        }
      });
      cleanups.push(() => void urlSub.remove());
    })();

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, [router]);

  // ── 2. "Orqaga" tugmasi ──
  // Alohida effektda, chunki xulq joriy sahifaga bog'liq: bosh sahifada
  // ilovadan chiqadi, boshqa joyda orqaga qaytadi. `pathname` o'zgarganda
  // tinglovchi yangilanib turishi kerak.
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
        // Bosh sahifada emasmiz — oddiy "orqaga"
        if (canGoBack && pathname !== HOME) {
          window.history.back();
          return;
        }
        // Ichkari sahifadamiz-u, tarix bo'sh (masalan bildirishnomadan
        // to'g'ri kelingan) — bosh sahifaga qaytamiz
        if (pathname !== HOME) {
          router.push(HOME);
          return;
        }

        // Bosh sahifadamiz. Bitta bosishda chiqib ketish — eng ko'p
        // uchraydigan tasodifiy yopilish sababi. Shu sabab tasdiq kerak.
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

// "Chiqish uchun yana bosing" — kichik qalqib chiquvchi yozuv.
// React holatiga bog'lamaymiz: bu tinglovchi ichidan chaqiriladi va
// ekranda atigi 2 soniya turadi.
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
