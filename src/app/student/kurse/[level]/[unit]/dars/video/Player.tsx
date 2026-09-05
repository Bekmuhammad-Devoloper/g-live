"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { markLessonWatched } from "../../actions";
import { protectScreen, unprotectScreen } from "@/lib/screenGuard";

// Gorizontal (to'liq ekran) video pleyer.
//
// Nega shunday: telefonda dars videosi tik holatda ekranning uchdan birini
// egallaydi. "Ko'rish" bosilganda pleyer to'liq ekranga chiqadi va imkoni
// bo'lsa yon holatga buriladi — o'quvchi telefonni burishi shart emas.
//
// Ikki texnik nozik joy:
//   1. To'liq ekran QATLAMNING O'ZIDA so'raladi. Ilgari `documentElement`
//      da so'ralardi va videoning yon tomonlarida OQ joy qolardi: to'liq
//      ekranga chiqqan element hujjat ildizi bo'lib, uning ichidagi `body`
//      ning och foni ko'rinib turardi. Endi to'liq ekran — qora qatlamning
//      o'zi, ya'ni videodan tashqari hamma joy qora.
//      Qatlam bosish paytida DOM da bo'lishi uchun `flushSync` ishlatiladi:
//      React holatni odatda keyinroq qo'llaydi, o'shanda element hali yo'q
//      bo'lib, requestFullscreen xato berardi.
//   2. Qatlam `document.body` ga PORTAL orqali chiziladi. Sababi: layout'da
//      kontent o'rami `relative z-10` — bu stacking context yaratadi va
//      ichidagi hech narsa undan tashqariga chiqa olmaydi. Pastki menyu esa
//      o'ramning TASHQARISIDA `z-40` da turadi, shuning uchun pleyerning
//      `z-[60]` i foyda bermay, menyu video ustida ko'rinib turardi.
//   3. screen.orientation.lock faqat Android'da va faqat to'liq ekranda
//      ishlaydi; iOS uni umuman qo'llab-quvvatlamaydi. Shuning uchun
//      xatosi yutiladi va o'sha holatda ekranda "telefonni buring" eslatmasi
//      ko'rsatiladi.

type Mode = "file" | "embed" | "link" | "none";

export default function Player({
  mode, src, lessonId, watched, playLabel, closeLabel, rotateHint,
}: {
  mode: Mode;
  src: string | null;
  lessonId: string;
  watched: boolean;
  playLabel: string;
  closeLabel: string;
  rotateHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  // Portal faqat brauzerda ishlaydi — serverda `document` yo'q
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  useEffect(() => setMounted(true), []);

  // Ball bir marta beriladi — takror ko'rish qo'shimcha bermaydi
  const mark = useCallback(() => {
    if (sent.current || watched) return;
    sent.current = true;
    void markLessonWatched(lessonId);
  }, [lessonId, watched]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      /* to'liq ekrandan chiqolmasa ham qatlam yopiladi */
    }
    try {
      (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
    } catch {
      /* burilishni ochib bo'lmasa ham muhim emas */
    }
  }, []);

  const play = async () => {
    // Qatlamni DARHOL chizamiz — keyingi qatorda unga murojaat qilamiz
    flushSync(() => setOpen(true));
    try {
      // Foydalanuvchi harakati ichida — shu sabab brauzer ruxsat beradi
      const box = boxRef.current;
      if (box && !document.fullscreenElement) await box.requestFullscreen();
    } catch {
      /* to'liq ekran bo'lmasa ham qatlam ochiq qoladi */
    }
    try {
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
      /* iOS qo'llab-quvvatlamaydi — pastdagi eslatma chiqadi */
    }
    mark();
  };

  // Tizim "orqaga" tugmasi yoki jest bilan to'liq ekrandan chiqilsa —
  // qatlam ham yopilsin, aks holda foydalanuvchi qora ekranda qolib ketadi.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── Video ochiq ekan, ekranni himoyalaymiz ──
  // Android ilovasida skrinshot va ekran yozuvi to'siladi (dars materiali
  // tarqalib ketmasin). Yopilganda darhol o'chiriladi: qolgan sahifalarni
  // o'quvchi bemalol skrinshot qila olsin.
  //
  // Tozalash funksiyasi HAR HOLDA himoyani o'chiradi — sahifadan chiqib
  // ketilsa yoki ilova qayta yuklansa ham telefon "himoyalangan" holatda
  // qolib ketmasligi kerak.
  useEffect(() => {
    if (!open) return;
    void protectScreen();
    return () => { void unprotectScreen(); };
  }, [open]);

  // Ekran tik holatda qolgan bo'lsa (iOS) — burishni so'raymiz
  useEffect(() => {
    if (!open) return;
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={play}
        disabled={mode === "none" || !src}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[14px] font-extrabold text-slate-900 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-50"
      >
        {playLabel}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </button>

      {open && mounted &&
        createPortal(
          <div ref={boxRef} className="fixed inset-0 z-[60] bg-black" role="dialog" aria-modal="true">
            {mode === "file" && src ? (
              <video
                src={src}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full bg-black object-contain"
                onEnded={mark}
              />
            ) : mode === "embed" && src ? (
              <iframe
                src={`${src}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={playLabel}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : null}

            {portrait && (
              <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                <span className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm">
                  {rotateHint}
                </span>
              </div>
            )}

          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          </div>,
          document.body,
        )}
    </>
  );
}
