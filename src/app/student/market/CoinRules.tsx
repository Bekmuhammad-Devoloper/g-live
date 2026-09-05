"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEAL } from "../_ui";

// Tangani qanday yig'ish mumkinligi — birin-ketin aylanadigan banner.
// Ilgari yettala qoida bitta ro'yxatda turib, hamyon kartasini uzun va
// o'qishga og'ir qilib qo'yardi. Endi har biri o'z bannerida tushuntiriladi.
//
// Xulq: 4 soniyada bir aylanadi; barmoq bilan surish yoki nuqtani bosish
// aylanishni to'xtatadi (foydalanuvchi o'zi boshqara boshladi degani).
// Tizimda "harakatni kamaytirish" yoqilgan bo'lsa avtomatik aylanmaydi.

export interface RuleSlide {
  key: string;
  label: string;   // "Dars videosini ko'rgani"
  hint: string;    // "Dars videosini oxirigacha ko'rsangiz"
  per: number | null; // bir marta uchun nechta tanga (pog'ona mukofoti har xil — null)
  count: number;   // necha marta bajarilgan
  total: number;   // jami yig'ilgan
}

const ROTATE_MS = 4000;

function Ico({ name, s = 26 }: { name: string; s?: number }) {
  const base = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: "white", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (name === "lesson") return (
    <svg {...base}><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M3.5 10h17M8.5 2.8V7M15.5 2.8V7" /><path d="m9.5 15 2 2 3.5-3.5" /></svg>
  );
  if (name === "lessonView") return (
    <svg {...base}><rect x="2.5" y="4.5" width="19" height="15" rx="3" /><path d="M10 9.5v5l4.5-2.5L10 9.5Z" fill="white" stroke="none" /></svg>
  );
  if (name === "homework") return (
    <svg {...base}><path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" /></svg>
  );
  if (name === "perfect") return (
    <svg {...base}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" fill="white" stroke="none" /></svg>
  );
  if (name === "gameWin") return (
    <svg {...base}><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" /><path d="M8 5.5H4.5v1.7A3.3 3.3 0 0 0 8 10.5M16 5.5h3.5v1.7a3.3 3.3 0 0 1-3.5 3.3" /><path d="M12 14v3.5M8.5 20.5h7M10 17.5h4" /></svg>
  );
  if (name === "streak7") return (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z" fill="white" /></svg>
  );
  if (name === "rankUp") return (
    <svg {...base}><path d="M4 20.5h4.5v-6H4v6ZM9.8 20.5h4.4V9h-4.4v11.5ZM15.5 20.5H20V4h-4.5v16.5Z" /><path d="m12 2.2.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 4.4l2-.3.9-1.9Z" fill="white" stroke="none" /></svg>
  );
  // levelUp
  return (
    <svg {...base}><path d="M4 19.5h16" /><path d="m5.5 15 4-4.5 3 2.5 5.5-6" /><path d="M14.5 6.5h3.6v3.6" /></svg>
  );
}

export default function CoinRules({ slides, title, timesLabel, totalLabel }: { slides: RuleSlide[]; title: string; timesLabel: string; totalLabel: string }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; moved: boolean } | null>(null);
  const n = slides.length;

  const go = useCallback((next: number) => setI(((next % n) + n) % n), [n]);

  // Avtomatik aylanish
  useEffect(() => {
    if (!auto || n < 2) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), ROTATE_MS);
    return () => clearInterval(id);
  }, [auto, n]);

  if (n === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, moved: false }; };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    if (!s.moved && Math.abs(dx) > 40) {
      s.moved = true;
      setAuto(false);          // foydalanuvchi o'zi boshqarmoqda
      go(i + (dx < 0 ? 1 : -1));
    }
  };
  const onTouchEnd = () => { touch.current = null; };

  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>
        {title}
      </div>

      <div
        className="relative overflow-hidden rounded-[22px]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Lenta — barcha bannerlar yonma-yon, faqat biri ko'rinadi */}
        <div
          ref={trackRef}
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {slides.map((s) => (
            <div key={s.key} className="w-full shrink-0">
              <div
                className="relative flex items-center gap-3.5 overflow-hidden p-4 text-white"
                style={{ background: "linear-gradient(115deg, #0c6a86 0%, #1590b3 55%, #4cb8d6 100%)" }}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Ico name={s.key} s={26} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-extrabold leading-tight">{s.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/80">{s.hint}</div>
                  {s.count > 0 ? (
                    <div className="mt-1 text-[11.5px] font-semibold text-white/70">
                      {s.count} {timesLabel} · {s.total}
                    </div>
                  ) : null}
                </div>

                {/* Bir marta uchun qancha berilishi. Pog'ona mukofoti har
                    pog'onada har xil — u yerda jami ko'rsatiladi. */}
                <span className="shrink-0 rounded-2xl bg-white/20 px-3 py-2 text-center backdrop-blur-sm">
                  <span className="block text-[19px] font-extrabold leading-none">+{s.per ?? s.total}</span>
                  {s.per === null ? (
                    <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-white/70">{totalLabel}</span>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nuqtalar — bosilsa o'sha bannerga o'tadi */}
      {n > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((s, k) => (
            <button
              key={s.key}
              aria-label={s.label}
              onClick={() => { setAuto(false); go(k); }}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: k === i ? 18 : 6,
                background: k === i ? TEAL : "rgba(19,78,94,0.22)",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
