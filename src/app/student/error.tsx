"use client";

import { useEffect } from "react";

// Kutilmagan xatolik yuz berganda ko'rinadigan sahifa.
//
// Bunisiz Next.js o'zining standart xato ekranini ko'rsatardi: ingliz tilida,
// oq fonda, ilovaning uslubiga umuman o'xshamaydigan. O'quvchi uchun bu
// "ilova buzildi" degan taassurot qoldirardi va qaytadan urinish yo'li yo'q edi.
//
// Matn o'zbekchada: xato chegarasi klient komponenti bo'lgani uchun serverdagi
// sessiya tilini o'qiy olmaydi, ilovaning asosiy tili esa o'zbekcha.

export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server jurnalida izlash uchun digest bilan birga yoziladi
    console.error("student portal xatosi:", error);
  }, [error]);

  return (
    <div className="gl-glass mt-10 flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/60">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4.5" />
          <path d="M12 17.2h.01" />
          <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>

      <div className="text-[18px] font-extrabold text-slate-900">Nimadir noto&apos;g&apos;ri ketdi</div>
      <p className="text-[13.5px] leading-relaxed text-slate-600">
        Sahifani ochib bo&apos;lmadi. Internetni tekshirib, qaytadan urinib ko&apos;ring.
        Takrorlansa — administratorga xabar bering.
      </p>

      <div className="flex w-full flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] w-full rounded-2xl text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #17a2bf, #0e7490)" }}
        >
          Qaytadan urinish
        </button>
        <a
          href="/student"
          className="grid min-h-[44px] w-full place-items-center rounded-2xl bg-white/60 text-[14px] font-bold text-slate-600"
        >
          Bosh sahifaga
        </a>
      </div>

      {/* Xato kodi — qo'llab-quvvatlashga aytish uchun */}
      {error.digest ? (
        <div className="pt-1 font-mono text-[11px] text-slate-500">#{error.digest}</div>
      ) : null}
    </div>
  );
}
