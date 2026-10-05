"use client";

import { useEffect, useState } from "react";

// Boshqaruv tizimi uchun xatolik chegarasi.
//
// Ilgari bu yerda chegara yo'q edi: server action yiqilsa (ko'pincha deploy'dan keyin
// eskirgan sahifa — "Failed to find Server Action") butun ilova Next'ning standart
// "Application error" ekraniga tushardi. Endi: server tomonidagi xato (digest bor)
// bo'lsa sahifa bir marta o'zi yangilanadi — eskirgan sahifa shunda tuzaladi;
// yangilangandan keyin ham xato qaytsa — tushunarli kartochka va tugmalar.

const KEY = "gl-error-reload-at";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!error.digest) return;
    try {
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < 60_000) return; // yaqinda yangilangan — aylanib qolmaylik
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch { /* xotira yopiq */ }
    setReloading(true);
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-2xl">!</div>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {reloading ? "Sahifa yangilanmoqda…" : "Xatolik yuz berdi"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {reloading
            ? "Tizim yangilangan bo'lishi mumkin — sahifa qayta yuklanmoqda."
            : "Amal bajarilmadi. Sahifani yangilab qayta urinib ko'ring; takrorlansa — texnik yordamga murojaat qiling."}
        </p>
        {!reloading && (
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => reset()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10">
              Qayta urinish
            </button>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              Sahifani yangilash
            </button>
          </div>
        )}
        {error.digest && !reloading && <p className="mt-4 font-mono text-[10px] text-slate-300 dark:text-slate-600">{error.digest}</p>}
      </div>
    </div>
  );
}
