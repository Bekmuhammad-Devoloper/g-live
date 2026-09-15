"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Ariza sahifasining qobig'i: fon, bezak dog'lari va — oflayn filial
 * tanlanganda — filial surati. Fon qatlami DOM'da kontentdan OLDIN turadi,
 * shuning uchun z-index'ga bog'liq emas: kontent har doim ustida.
 * Forma suratni `useApplyBg()` orqali beradi.
 */
const BgCtx = createContext<(url: string | null) => void>(() => {});

export function useApplyBg() {
  return useContext(BgCtx);
}

export default function ApplyShell({ children }: { children: React.ReactNode }) {
  const [bg, setBgState] = useState<string | null>(null);
  const setBg = useCallback((url: string | null) => setBgState(url), []);

  return (
    <BgCtx.Provider value={setBg}>
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#f3f5fb] text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
        {/* Filial surati — butun sahifa; ustida oq parda (matn o'qilishi uchun) */}
        {bg && (
          <div key={bg} className="animate-pop-in absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${bg}")` }} aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/70 to-[#f3f5fb]/95 dark:from-[#0b1220]/70 dark:via-[#0b1220]/80 dark:to-[#0b1220]/95" />
          </div>
        )}
        {/* Bezak dog'lari — surat bo'lmaganda */}
        {!bg && (
          <>
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
            <div className="pointer-events-none absolute -right-24 top-56 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/15" />
          </>
        )}
        {children}
      </div>
    </BgCtx.Provider>
  );
}
