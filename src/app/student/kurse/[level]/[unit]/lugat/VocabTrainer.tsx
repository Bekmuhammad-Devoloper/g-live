"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LessonWord } from "@/lib/lessonWords";
import type { StudentStrings } from "../../../../_i18n";
import { markVocabMastered } from "../actions";

// So'z mashqi — tarjimasi ko'rsatiladi, nemischasi variantlardan tanlanadi.
//
// ASOSIY QOIDA: mashq HAMMA so'z to'g'ri tanlangunicha tugamaydi. Xato
// qilingan so'z navbatdan chiqmaydi, birozdan keyin qaytib keladi. Shu sabab
// "o'tib ketdim, lekin bilmayman" degan holat bo'lmaydi — chiqish uchun har
// bir so'zni bilish shart.
//
// Xato qilingan so'z navbatning OXIRIGA emas, uch qadam narisiga qo'yiladi:
// oxiriga tashlansa o'quvchi uni allaqachon unutgan bo'ladi, darhol qaytsa
// esa javobni eslab qoladi-yu, so'zni emas. Uch qadam — oraliq masofa.

const REQUEUE_AFTER = 3;

/** Faqat tarjimasi bor so'zlar mashqqa kiradi — savol o'zbekcha beriladi */
export const practicable = (words: LessonWord[]) => words.filter((w): w is LessonWord & { uz: string } => !!w.uz);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Q {
  word: LessonWord & { uz: string };
  options: string[];
}

export default function VocabTrainer({
  words, lessonId, t, accent, label,
}: {
  words: LessonWord[];
  lessonId: string;
  t: StudentStrings;
  /** Bo'lim rangi — sarlavha va tugmalar bilan bir xil */
  accent: string;
  /** Tugmadagi yozuv */
  label: string;
}) {
  const pool = useMemo(() => practicable(words), [words]);
  const [open, setOpen] = useState(false);

  if (pool.length < 2) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(224,146,23,0.9)] transition active:scale-[0.985]"
        style={{ background: accent }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="3.4" />
          <path d="m18 6 3.2-3.2M17 4.6h2.4V7" />
        </svg>
        {label}
      </button>

      {open && <Session pool={pool} lessonId={lessonId} t={t} accent={accent} onClose={() => setOpen(false)} />}
    </>
  );
}

function Session({
  pool, lessonId, t, accent, onClose,
}: {
  pool: (LessonWord & { uz: string })[];
  lessonId: string;
  t: StudentStrings;
  accent: string;
  onClose: () => void;
}) {
  const total = pool.length;

  // Navbat — so'zlarning tartib raqamlari. Boshida aralashtiriladi.
  const [queue, setQueue] = useState<number[]>(() => shuffle(pool.map((_, i) => i)));
  const [picked, setPicked] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [right, setRight] = useState(0);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = queue.length === 0;
  const idx = queue[0];

  // Savol — joriy so'z va uchta chalg'ituvchi variant.
  // `idx` o'zgarmaguncha qayta hisoblanmaydi, aks holda har chizishda
  // variantlar joyini almashtirib, o'quvchini chalg'itardi.
  const q: Q | null = useMemo(() => {
    if (idx === undefined) return null;
    const word = pool[idx];
    const others = pool.filter((_, i) => i !== idx).map((w) => w.de);
    const distractors = shuffle(others).slice(0, Math.min(3, others.length));
    return { word, options: shuffle([word.de, ...distractors]) };
  }, [idx, pool]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Hammasi to'g'ri tanlangach natijani saqlaymiz — bir marta
  useEffect(() => {
    if (!done || saved) return;
    setSaved(true);
    void markVocabMastered(lessonId);
  }, [done, saved, lessonId]);

  const pick = useCallback((opt: string) => {
    if (picked || !q) return;
    setPicked(opt);
    setTries((n) => n + 1);

    const ok = opt === q.word.de;
    if (ok) {
      setRight((n) => n + 1);
      navigator.vibrate?.(8);
    } else {
      navigator.vibrate?.([12, 60, 12]);
    }

    // To'g'ri javobda tez o'tamiz; xatoda o'quvchi to'g'risini ko'rib
    // ulgurishi uchun uzunroq turadi.
    timer.current = setTimeout(() => {
      setPicked(null);
      setQueue((prev) => {
        const [head, ...rest] = prev;
        if (ok) return rest;
        // Xato — so'zni uch qadam narida qaytaramiz
        const at = Math.min(REQUEUE_AFTER, rest.length);
        return [...rest.slice(0, at), head, ...rest.slice(at)];
      });
    }, ok ? 480 : 1250);
  }, [picked, q]);

  const learned = total - queue.length;
  const pct = Math.round((learned / total) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4f7f9]" role="dialog" aria-modal="true">
      {/* ── Tepa qator: jarayon va yopish ── */}
      <div
        className="shrink-0 px-4 pb-4"
        style={{ paddingTop: "calc(14px + var(--gl-safe-top, env(safe-area-inset-top)))" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-[0_4px_12px_-6px_rgba(15,60,80,0.6)] transition active:scale-95"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-white shadow-[inset_0_1px_3px_rgba(19,78,94,0.14)]">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%`, background: accent }}
            />
          </div>

          <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums text-slate-700">
            {learned}/{total}
          </span>
        </div>
      </div>

      {done ? (
        <Finished t={t} accent={accent} tries={tries} right={right} total={total} onClose={onClose} />
      ) : q ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          {/* ── Savol ── */}
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
            <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t.chooseGerman}
            </span>
            <span className="max-w-full break-words px-2 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
              {q.word.uz}
            </span>
          </div>

          {/* ── Variantlar ── */}
          <div className="grid shrink-0 gap-2.5">
            {q.options.map((opt) => {
              const isRight = opt === q.word.de;
              const chosen = picked === opt;
              // Javob berilgunicha hamma variant bir xil. Berilgach: to'g'risi
              // doim yashil (o'quvchi to'g'risini ko'rsin), tanlangan xato qizil.
              const state = !picked ? "idle" : isRight ? "right" : chosen ? "wrong" : "dim";
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(opt)}
                  disabled={!!picked}
                  className={
                    "flex min-h-[62px] items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition active:scale-[0.985] " +
                    (state === "right"
                      ? "border-emerald-400 bg-emerald-50"
                      : state === "wrong"
                        ? "border-rose-400 bg-rose-50"
                        : state === "dim"
                          ? "border-transparent bg-white/50 opacity-45"
                          : "border-transparent bg-white shadow-[0_6px_16px_-10px_rgba(15,60,80,0.7)]")
                  }
                >
                  <span className="min-w-0 flex-1 break-words text-[17px] font-extrabold leading-snug text-slate-900">
                    {opt}
                  </span>
                  {state === "right" && <Mark kind="right" />}
                  {state === "wrong" && <Mark kind="wrong" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function Mark({ kind }: { kind: "right" | "wrong" }) {
  return (
    <span
      className={
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-white " +
        (kind === "right" ? "bg-emerald-500" : "bg-rose-500")
      }
    >
      {kind === "right" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </span>
  );
}

/* ── Tugash ekrani ── */
function Finished({
  t, accent, tries, right, total, onClose,
}: {
  t: StudentStrings;
  accent: string;
  tries: number;
  right: number;
  total: number;
  onClose: () => void;
}) {
  // Aniqlik — birinchi urinishdan to'g'ri chiqqanlar ulushi.
  // `right` har doim `total` ga teng bo'ladi (mashq shundan tugaydi),
  // shuning uchun ma'noli ko'rsatkich urinishlar soniga nisbatan.
  const acc = tries > 0 ? Math.round((right / tries) * 100) : 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-center">
      <span
        className="mb-5 grid h-24 w-24 place-items-center rounded-full text-white shadow-[0_16px_34px_-16px_rgba(224,146,23,0.95)]"
        style={{ background: accent }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      </span>

      <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">{t.vocabDone}</h2>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-slate-500">{t.vocabDoneNote}</p>

      <div className="mt-7 flex w-full max-w-[320px] gap-2.5">
        <Stat value={String(total)} label={t.wordCount} />
        <Stat value={String(tries)} label={t.attempts} />
        <Stat value={`${acc}%`} label={t.accuracy} />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-8 w-full max-w-[320px] rounded-[18px] py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(224,146,23,0.9)] transition active:scale-[0.985]"
        style={{ background: accent }}
      >
        {t.close}
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[18px] bg-white px-2 py-3 shadow-[0_6px_16px_-12px_rgba(15,60,80,0.8)]">
      <div className="text-[20px] font-extrabold tabular-nums leading-none text-slate-900">{value}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{label}</div>
    </div>
  );
}
