"use client";

import { useEffect, useState } from "react";

// Yangi deploy'dan keyin ochiq qolgan sahifa muammosi.
//
// Deploy'da server action identifikatorlari o'zgaradi. Brauzerda eski sahifa ochiq
// turgan bo'lsa, undagi har bir "Saqlash" serverga eski identifikator bilan boradi va
// "Failed to find Server Action" bilan yiqiladi — foydalanuvchi uchun tugma shunchaki
// "ishlamaydi". Bu komponent ikki yo'l bilan oldini oladi:
//
//   1. Har 2 daqiqada (va oynaga qaytilganda) /api/version so'raladi. Build o'zgargan
//      bo'lsa pastda "Tizim yangilandi — Yangilash" eslatmasi chiqadi. Sahifa O'ZICHA
//      faqat ko'rinmayotgan (boshqa oynaga o'tilgan) va hech narsa yozilmagan holatda
//      yangilanadi — test yoki forma yarmida turgan odamning ishi yo'qolmasin.
//   2. Eski sahifadan ketgan so'rov baribir yiqilsa (unhandledrejection / error) —
//      hech narsa yozilmagan bo'lsa sahifa bir marta yangilanadi (30 s qulf), aks holda
//      eslatma chiqadi va foydalanuvchi o'zi yangilaydi.

const STALE = /Server Action|older or newer deployment|unexpected response was received|Server Components render|Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i;
const KEY = "gl-stale-reload-at";
const POLL_MS = 2 * 60 * 1000;

function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* xotira yopiq — baribir yangilaymiz */ }
  window.location.reload();
  return true;
}

// Sahifada biror maydon to'ldirilgan yoki tanlov qilinganmi (test javoblari ham) —
// shunday holatda sahifa hech qachon o'zicha yangilanmaydi
let dirty = false;
const markDirty = () => { dirty = true; };

/** Sahifa ko'rinmayapti va unda yozilgan narsa yo'q — yangilash xavfsiz */
const safeToReload = () => !dirty && document.visibilityState === "hidden" && !document.querySelector('.drawer-panel, [role="dialog"], [role="alertdialog"]');

export default function DeployWatcher({ build }: { build: string }) {
  const [outdated, setOutdated] = useState(false);

  // 2) Eskirgan sahifadan ketgan so'rov xatosi
  useEffect(() => {
    const stale = () => { if (dirty) setOutdated(true); else if (!reloadOnce()) setOutdated(true); };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason as Error)?.message ?? e.reason ?? "");
      if (STALE.test(msg)) { e.preventDefault(); stale(); }
    };
    const onError = (e: ErrorEvent) => {
      if (STALE.test(String(e.message ?? ""))) { e.preventDefault(); stale(); }
    };
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  // 1) Build tekshiruvi
  useEffect(() => {
    if (!build || build === "dev") return;
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { build?: string };
        if (stopped || !j.build || j.build === build) return;
        if (safeToReload()) { reloadOnce(); return; }
        setOutdated(true);
      } catch { /* tarmoq yo'q — keyingi safar */ }
    };
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [build]);

  if (!outdated) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm shadow-pop dark:border-amber-500/30 dark:bg-slate-900">
        <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">Tizim yangilandi — davom etish uchun sahifani yangilang.</span>
        <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Yangilash
        </button>
      </div>
    </div>
  );
}
