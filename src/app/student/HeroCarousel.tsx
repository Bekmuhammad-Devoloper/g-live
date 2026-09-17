"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bosh sahifadagi asosiy karta karuseli — kurs banneri va "Keyingi dars"
 * kartasi bitta joyda navbat bilan ko'rinadi: har 5 sekundda almashadi,
 * barmoq bilan surish yoki nuqtaga bosish ham mumkin. Slaydlar bir-birining
 * ustida turadi (grid 1/1), shuning uchun balandlik eng balandi bo'yicha —
 * almashganda sahifa "sakramaydi".
 */
export default function HeroCarousel({ slides, interval = 5000 }: { slides: ReactNode[]; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    const id = setInterval(() => setI((k) => (k + 1) % n), interval);
    return () => clearInterval(id);
  }, [n, paused, interval]);

  if (n === 0) return null;
  if (n === 1) return <>{slides[0]}</>;

  const go = (k: number) => setI(((k % n) + n) % n);

  return (
    <div
      className="relative"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
      }}
    >
      <div className="grid">
        {slides.map((s, k) => (
          <div
            key={k}
            aria-hidden={k !== i}
            className={
              "col-start-1 row-start-1 transition-all duration-500 ease-out " +
              (k === i ? "z-10 translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0")
            }
          >
            {s}
          </div>
        ))}
      </div>
      <div className="absolute bottom-2.5 left-4 z-20 flex items-center gap-1.5">
        {slides.map((_, k) => (
          <button
            key={k}
            type="button"
            aria-label={`${k + 1}/${n}`}
            onClick={() => go(k)}
            className={"h-[6px] rounded-full transition-all " + (k === i ? "w-6 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" : "w-[6px] bg-white/45")}
          />
        ))}
      </div>
    </div>
  );
}
