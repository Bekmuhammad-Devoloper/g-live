"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ICON_GRADIENT } from "../_ui";

// Umumiy lug'at uchun qidiruv va A–Z harf tasmasi. Natijani server chiqaradi
// (6000+ so'z brauzerga yuborilmasin), shu sabab bu yerda faqat URL yangilanadi.

export default function DictNav({ letters }: { letters: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  const push = (next: { q?: string; l?: string | null }) => {
    const p = new URLSearchParams(sp.toString());
    p.set("tab", "lugat");
    p.delete("n");
    if (next.q !== undefined) {
      if (next.q) p.set("q", next.q);
      else p.delete("q");
    }
    if (next.l !== undefined) {
      if (next.l) p.set("l", next.l);
      else p.delete("l");
    }
    start(() => router.replace(`?${p.toString()}`, { scroll: false }));
  };

  // Yozayotganda 300 ms kutamiz — har harfda so'rov ketmasin
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q, l: q ? null : undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = sp.get("l") ?? "";

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nemischa yoki o'zbekcha so'z…"
          className="h-12 w-full rounded-2xl border-0 bg-white pl-11 pr-11 text-[15px] text-slate-900 shadow-[0_6px_16px_rgba(19,78,94,0.10)] outline-none placeholder:text-slate-400"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Tozalash"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-slate-100 text-slate-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        {pending && <span className="absolute -bottom-[7px] left-4 right-4 h-[2px] animate-pulse rounded-full bg-[#17a2bf]/40" />}
      </div>

      {/* A–Z tasmasi */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={!active} onClick={() => push({ l: null })}>Barchasi</Chip>
        {letters.map((c) => (
          <Chip key={c} active={active === c} onClick={() => push({ l: active === c ? null : c })}>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 min-w-[36px] shrink-0 rounded-xl px-2.5 text-[13.5px] font-bold transition ${
        active ? "text-white shadow-[0_6px_14px_rgba(14,116,144,0.28)]" : "bg-white text-slate-500 shadow-[0_4px_12px_rgba(19,78,94,0.08)]"
      }`}
      style={active ? { background: ICON_GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}
