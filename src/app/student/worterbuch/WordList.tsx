"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StudentStrings } from "../_i18n";
import { CARD, ICON_GRADIENT, TEAL } from "../_ui";

// "Kursim" bo'limi — darslardagi so'zlar.
// Tarjima faqat ustoz "das Haus - uy" ko'rinishida yozgan bo'lsa chiqadi;
// aks holda so'zning yonidagi tugma umumiy lug'atdan qidirib beradi
// (bazani avtomatik ulash noto'g'ri ma'no berishi mumkin, shu sabab tanlov
// o'quvchida qoladi).

export type VWord = { de: string; uz: string | null; lesson: string; level: string; learned: boolean };

// Katak daftar varag'i — umumiy lug'at bilan bir xil ko'rinish
const SHEET: React.CSSProperties = {
  backgroundColor: "#fcfdff",
  backgroundImage:
    "linear-gradient(rgba(120,170,200,0.20) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(120,170,200,0.20) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

export default function WordList({ words, t, levelCodes }: { words: VWord[]; t: StudentStrings; /** Sozlamalar > Darajalar tartibi */ levelCodes: string[] }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string | null>(null);

  const levels = useMemo(() => levelCodes.filter((c) => words.some((w) => w.level === c)), [words, levelCodes]);
  const learned = useMemo(() => words.filter((w) => w.learned).length, [words]);
  const pct = words.length ? Math.round((learned / words.length) * 100) : 0;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return words.filter(
      (w) =>
        (!level || w.level === level) &&
        (!needle ||
          w.de.toLowerCase().includes(needle) ||
          (w.uz ?? "").toLowerCase().includes(needle) ||
          w.lesson.toLowerCase().includes(needle)),
    );
  }, [words, q, level]);

  // Dars bo'yicha guruhlash — tartib asl ro'yxatdagidek
  const groups = useMemo(() => {
    const map = new Map<string, VWord[]>();
    for (const w of shown) {
      const arr = map.get(w.lesson);
      if (arr) arr.push(w);
      else map.set(w.lesson, [w]);
    }
    return [...map.entries()];
  }, [shown]);

  if (words.length === 0) {
    return (
      <div className={CARD + " px-5 py-12 text-center"}>
        <div className="text-[15px] font-semibold text-slate-700">{t.emptyDict}</div>
        <p className="mt-1 text-[13px] text-slate-500">{t.teacherAddsWords}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── O'zlashtirish ── */}
      <div className={CARD + " p-4"}>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-slate-700">{t.learnedWords}</span>
          <span className="text-[13px] font-extrabold" style={{ color: TEAL }}>
            {learned}/{words.length}
          </span>
        </div>
        <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/55">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ICON_GRADIENT }} />
        </div>
      </div>

      {/* ── Qidiruv ── */}
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
          placeholder={t.searchWord}
          className="h-12 w-full rounded-2xl border-0 bg-white pl-11 pr-4 text-[16px] text-slate-900 shadow-[0_6px_16px_rgba(19,78,94,0.10)] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0e7490]/40"
        />
      </div>

      {/* ── Daraja ── */}
      {levels.length > 1 ? (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={level === null} onClick={() => setLevel(null)}>
            {t.all}
          </Chip>
          {levels.map((c) => (
            <Chip key={c} active={level === c} onClick={() => setLevel(level === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className={CARD + " px-5 py-10 text-center"}>
          <div className="text-[14px] font-semibold text-slate-700">{t.notFound}</div>
          <p className="mt-1 text-[12.5px] text-slate-500">{t.tryAnother}</p>
        </div>
      ) : (
        groups.map(([lesson, items], gi) => (
          <section key={lesson} className="overflow-hidden rounded-[18px] shadow-[0_10px_22px_rgba(19,78,94,0.10)]">
            {/* Dars sarlavhasi */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold text-white"
                style={{ background: ICON_GRADIENT }}
              >
                {gi + 1}
              </span>
              <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-700">{lesson}</div>
              <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                {items[0].level} · {items.length}
              </span>
            </div>

            {/* Katak varaq: chapda nemischa, o'ngda o'zbekcha */}
            <ul style={SHEET}>
              {items.map((w) => (
                <li key={lesson + w.de} className="grid grid-cols-[1fr_1fr] border-b border-[#bcd8e8] last:border-0">
                  <div className="flex min-w-0 items-start gap-2 border-r-2 border-[#efb0b0] px-3 py-3">
                    <span
                      className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{ background: w.learned ? TEAL : "#dbe6ee" }}
                      title={w.learned ? t.learnedWord : t.notLearnedYet}
                    />
                    <span className="min-w-0 hyphens-auto break-words text-[15px] font-extrabold leading-6 text-slate-900">
                      {w.de}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-start gap-2 px-3 py-3">
                    <span className="min-w-0 flex-1 break-words text-[14px] leading-6 text-slate-700">{w.uz ?? ""}</span>
                    <Link
                      href={`/student/worterbuch?tab=lugat&q=${encodeURIComponent(w.de)}`}
                      aria-label={t.findInDictionary}
                      title={t.findInDictionary}
                      className="-mb-3 -mr-3 -mt-[10px] grid h-11 w-11 shrink-0 place-items-center text-slate-300 transition active:scale-90"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-9 shrink-0 rounded-xl px-3.5 text-[13.5px] font-bold transition " +
        (active ? "text-white shadow-[0_6px_14px_rgba(14,116,144,0.28)]" : "bg-white text-slate-500 shadow-[0_4px_12px_rgba(19,78,94,0.08)]")
      }
      style={active ? { background: ICON_GRADIENT } : undefined}
    >
      {children}
    </button>
  );
}
