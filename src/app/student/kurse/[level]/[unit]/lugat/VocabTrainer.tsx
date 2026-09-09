"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { practicableWords, splitArticle, type LessonWord } from "@/lib/lessonWords";
import { nativeSpeechAvailable } from "@/lib/nativeSpeech";
import type { StudentStrings } from "../../../../_i18n";
import { markVocabMastered, recordVocabStage } from "../actions";
import SpeakStage from "./SpeakStage";

// So'z mashqi — TO'RT BOSQICH, har biri oldingisidan qiyinroq.
//
//   1. Tanish   — tarjimasi beriladi, nemischasi variantlardan tanlanadi
//   2. Teskari  — nemischasi beriladi, tarjimasi variantlardan tanlanadi
//   3. Yasash   — tarjimasi beriladi, nemischasi HARFLARDAN yig'iladi
//   4. Talaffuz — so'z ko'rsatiladi, o'quvchi uni OVOZ CHIQARIB aytadi
//
// Nega shu tartib: tanish eng oson (javob ko'z oldida turadi), teskarisi
// so'zni boshqa yo'nalishda tekshiradi, yig'ish so'zni yozma tiklashni
// talab qiladi, talaffuz esa eng qiyini — so'z endi ekranda emas, og'izda.
// Ya'ni tanishdan gapirishga o'tiladi.
//
// 4-bosqich mikrofon va tashqi xizmat (Gemini) ga tayanadi. Ular yo'q
// bo'lsa mashq UCH bosqichda tugaydi — `canSpeak` shuni belgilaydi.
//
// ASOSIY QOIDA (har bosqichda): bosqich HAMMA so'z to'g'ri bajarilgunicha
// tugamaydi. Xato qilingan so'z navbatdan chiqmaydi, birozdan keyin qaytib
// keladi. Barcha bosqich tugagach lug'at o'zlashtirilgan hisoblanadi.
//
// Xato qilingan so'z navbatning OXIRIGA emas, bir necha qadam narisiga
// qo'yiladi: oxiriga tashlansa o'quvchi uni allaqachon unutgan bo'ladi,
// darhol qaytsa esa javobni eslab qoladi-yu, so'zni emas. Masofa qat'iy
// emas (3-5), aks holda tartibning o'zi yodlanib qolardi.

const REQUEUE_MIN = 3;
const REQUEUE_SPREAD = 3;
type Stage = 1 | 2 | 3 | 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Word = LessonWord & { uz: string };

export default function VocabTrainer({
  words, lessonId, t, accent, label, canSpeak = false,
}: {
  words: LessonWord[];
  lessonId: string;
  t: StudentStrings;
  /** Bo'lim rangi — sarlavha va tugmalar bilan bir xil */
  accent: string;
  /** Tugmadagi yozuv */
  label: string;
  /** Serverda Gemini kaliti sozlanganmi — brauzerdagi talaffuz shu orqali */
  canSpeak?: boolean;
}) {
  const pool = useMemo(() => practicableWords(words), [words]);
  const [open, setOpen] = useState(false);
  /** Androidning o'z nutq tanish tizimi bormi */
  const [nativeSpeech, setNativeSpeech] = useState(false);

  // Talaffuz bosqichi ikki yo'ldan biri bo'lsa: telefon nutqni o'zi
  // taniydi (ilova, afzal) yoki serverda Gemini kaliti bor (brauzer,
  // yopiq tanlov bilan). Ikkisi ham bo'lmasa — uch bosqich.
  useEffect(() => {
    let cancelled = false;
    void nativeSpeechAvailable().then((v) => { if (!cancelled) setNativeSpeech(v); });
    return () => { cancelled = true; };
  }, []);

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

      {open && (
        <Session
          pool={pool}
          lessonId={lessonId}
          t={t}
          accent={accent}
          lastStage={nativeSpeech || canSpeak ? 4 : 3}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Session({
  pool, lessonId, t, accent, lastStage, onClose,
}: {
  pool: Word[];
  lessonId: string;
  t: StudentStrings;
  accent: string;
  /** Oxirgi bosqich — talaffuz mumkin bo'lmasa 3 */
  lastStage: Stage;
  onClose: () => void;
}) {
  const total = pool.length;

  const [stage, setStage] = useState<Stage>(1);
  // Navbat — so'zlarning tartib raqamlari, har bosqich boshida aralashadi
  const [queue, setQueue] = useState<number[]>(() => shuffle(pool.map((_, i) => i)));
  const [picked, setPicked] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [right, setRight] = useState(0);
  /** Nechanchi savol — variantlarni qayta aralashtirish uchun */
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageDone = queue.length === 0;
  const allDone = stageDone && stage >= lastStage;
  const idx = queue[0];

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Barcha bosqich tugagach natijani saqlaymiz — bir marta
  useEffect(() => {
    if (!allDone || saved) return;
    setSaved(true);
    void markVocabMastered(lessonId);
  }, [allDone, saved, lessonId]);

  // Har bosqich tugaganda ko'nikma balli (bosh sahifadagi plitkalar).
  // Bir bosqich uchun bir marta — ref to'plami; server ham kalit bo'yicha
  // takrorni o'tkazmaydi, bu yerdagisi ortiqcha so'rov bo'lmasin uchun.
  const recorded = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!stageDone || recorded.current.has(stage)) return;
    recorded.current.add(stage);
    void recordVocabStage(lessonId, stage);
  }, [stageDone, stage, lessonId]);

  const nextStage = useCallback(() => {
    setStage((s) => (s < lastStage ? ((s + 1) as Stage) : s));
    setQueue(shuffle(pool.map((_, i) => i)));
    setRound((n) => n + 1);
    setPicked(null);
  }, [pool, lastStage]);

  /** Talaffuz bosqichini o'tkazib yuborish — mikrofon ishlamasa */
  const skipStage = useCallback(() => {
    setQueue([]);
    setPicked(null);
  }, []);

  /**
   * Javob qabul qilinadi. `ok` — to'g'rimi.
   *
   * Navbat va bosqich holati faqat SHU YERDA o'zgaradi, uchala bosqich
   * uchun bir xil: bosqichlar faqat savol ko'rinishi bilan farq qiladi,
   * qoidalari emas.
   */
  const answer = useCallback((ok: boolean, mark: string) => {
    setPicked(mark);
    setTries((n) => n + 1);
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
      setRound((n) => n + 1); // variantlar/harflar qaytadan aralashsin
      setQueue((prev) => {
        const [head, ...rest] = prev;
        if (ok) return rest;
        const at = Math.min(REQUEUE_MIN + Math.floor(Math.random() * REQUEUE_SPREAD), rest.length);
        return [...rest.slice(0, at), head, ...rest.slice(at)];
      });
    }, ok ? 480 : 1250);
  }, []);

  const learned = total - queue.length;
  // Umumiy jarayon — barcha bosqich bo'yicha
  const overall = Math.round((((stage - 1) * total + learned) / (total * lastStage)) * 100);

  const stageName =
    stage === 1 ? t.stage1Name : stage === 2 ? t.stage2Name : stage === 3 ? t.stage3Name : t.stage4Name;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4f7f9]" role="dialog" aria-modal="true">
      {/* ── Tepa qator: bosqich, jarayon, yopish ── */}
      <div
        className="shrink-0 px-4 pb-3"
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
              style={{ width: `${overall}%`, background: accent }}
            />
          </div>

          <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums text-slate-700">
            {learned}/{total}
          </span>
        </div>

        {/* Bosqich belgisi — har bosqichga bitta chiziqcha va nomi */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: lastStage }, (_, i) => i + 1).map((s) => (
              <span
                key={s}
                className="h-[3px] w-6 rounded-full transition-colors"
                style={{ background: s <= stage ? accent : "rgba(19,78,94,0.16)" }}
              />
            ))}
          </div>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {t.stage} {stage} · {stageName}
          </span>
        </div>
      </div>

      {allDone ? (
        <Finished t={t} accent={accent} tries={tries} right={right} total={total} onClose={onClose} />
      ) : stageDone ? (
        <StageBreak t={t} accent={accent} nextStage={(stage + 1) as Stage} onNext={nextStage} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          {stage === 4 ? (
            <SpeakStage
              key={`${idx}-${round}`}
              word={pool[idx].de}
              wordIndex={idx}
              lessonId={lessonId}
              t={t}
              accent={accent}
              picked={picked}
              onAnswer={answer}
              onSkip={skipStage}
            />
          ) : stage === 3 ? (
            <BuildStage key={`${idx}-${round}`} word={pool[idx]} t={t} accent={accent} picked={picked} onAnswer={answer} />
          ) : (
            <ChoiceStage
              key={`${idx}-${round}`}
              stage={stage}
              word={pool[idx]}
              pool={pool}
              idx={idx}
              t={t}
              picked={picked}
              onAnswer={answer}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ── 1 va 2-bosqich: variantlardan tanlash ── */

function ChoiceStage({
  stage, word, pool, idx, t, picked, onAnswer,
}: {
  stage: Stage;
  word: Word;
  pool: Word[];
  idx: number;
  t: StudentStrings;
  picked: string | null;
  onAnswer: (ok: boolean, mark: string) => void;
}) {
  // 1-bosqich: savol tarjimasi, javob nemischa. 2-bosqich — teskarisi.
  const asking = stage === 1 ? word.uz : word.de;
  const correct = stage === 1 ? word.de : word.uz;

  // Chalg'ituvchi variantlar. JAVOBI aynan shu so'z bilan bir xil bo'lganlari
  // chiqarib tashlanadi: "das Auto - mashina" va "der Wagen - mashina" bo'lsa,
  // savol "mashina" bo'lib, ikkala variant ham to'g'ri bo'lardi-yu, bittasi
  // xato deb belgilanardi. Ikkinchi bosqichda ham xuddi shunday, faqat
  // tomonlari almashgan.
  const options = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const key = norm(correct);
    const safe = pool.filter((w, i) => i !== idx && norm(stage === 1 ? w.de : w.uz) !== key);
    const source = safe.length > 0 ? safe : pool.filter((_, i) => i !== idx);
    const others = source.map((w) => (stage === 1 ? w.de : w.uz));
    return shuffle([correct, ...shuffle(others).slice(0, Math.min(3, others.length))]);
  }, [correct, pool, idx, stage]);

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {stage === 1 ? t.chooseGerman : t.chooseUzbek}
        </span>
        <span className="max-w-full break-words px-2 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
          {asking}
        </span>
      </div>

      <div className="grid shrink-0 gap-2.5">
        {options.map((opt) => {
          const isRight = opt === correct;
          const chosen = picked === opt;
          // Javob berilgunicha hamma variant bir xil. Berilgach: to'g'risi doim
          // yashil (o'quvchi to'g'risini ko'rsin), tanlangan xato qizil.
          const state = !picked ? "idle" : isRight ? "right" : chosen ? "wrong" : "dim";
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !picked && onAnswer(isRight, opt)}
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
    </>
  );
}

/* ── 3-bosqich: harflardan so'zni yig'ish ── */

interface Tile {
  /** Harfning o'zi */
  ch: string;
  /** Qaysi katakka qo'yilgani; qo'yilmagan bo'lsa null */
  slot: number | null;
}

function BuildStage({
  word, t, accent, picked, onAnswer,
}: {
  word: Word;
  t: StudentStrings;
  accent: string;
  picked: string | null;
  onAnswer: (ok: boolean, mark: string) => void;
}) {
  // Artikl TAYYOR beriladi, faqat ot yig'iladi: "der" ning uch harfi ham
  // sochilib yursa mashq uzun va ma'nosiz bo'lardi.
  const { article, rest } = useMemo(() => splitArticle(word.de), [word.de]);

  // Bo'sh joy ("guten Morgen" kabi ikki so'zli yozuvlarda) yig'ilmaydi —
  // u ham tayyor turadi, aks holda o'quvchi ko'rinmas harfni qidirardi.
  const letters = useMemo(() => [...rest], [rest]);
  const buildable = useMemo(
    () => letters.map((ch, i) => ({ ch, i })).filter(({ ch }) => ch.trim() !== ""),
    [letters],
  );

  const [tiles, setTiles] = useState<Tile[]>(() =>
    shuffle(buildable.map(({ ch }) => ch)).map((ch) => ({ ch, slot: null })),
  );

  // Kataklar: bo'sh joylar boshidan to'la, harf kataklari bo'sh
  const filled = useMemo(() => {
    const out: (string | null)[] = letters.map((ch) => (ch.trim() === "" ? ch : null));
    for (const tile of tiles) {
      if (tile.slot !== null) out[tile.slot] = tile.ch;
    }
    return out;
  }, [letters, tiles]);

  const emptySlots = useMemo(
    () => buildable.map(({ i }) => i).filter((i) => filled[i] === null),
    [buildable, filled],
  );

  const put = (ti: number) => {
    if (picked || tiles[ti].slot !== null || emptySlots.length === 0) return;
    const target = emptySlots[0];
    setTiles((prev) => prev.map((x, i) => (i === ti ? { ...x, slot: target } : x)));
  };

  const take = (slot: number) => {
    if (picked) return;
    setTiles((prev) => prev.map((x) => (x.slot === slot ? { ...x, slot: null } : x)));
  };

  const clear = () => {
    if (picked) return;
    setTiles((prev) => prev.map((x) => ({ ...x, slot: null })));
  };

  // Hamma katak to'lgach o'zi tekshiradi — alohida "Tekshirish" tugmasi
  // qo'shimcha bosish demakdir, javob esa allaqachon tayyor.
  const answered = useRef(false);
  useEffect(() => {
    if (answered.current || picked || emptySlots.length > 0) return;
    answered.current = true;
    const built = filled.join("");
    onAnswer(built === rest, built);
  }, [emptySlots.length, filled, rest, onAnswer, picked]);

  const wrong = picked !== null && picked !== rest;

  // Kataklar bitta qatorga sig'ishi uchun uzun so'zda kichrayadi. Enini
  // flex hal qiladi, balandlik va shrift esa harflar soniga qarab tanlanadi
  // — aks holda 14 harfli so'zda ingichka va baland kataklar chiqardi.
  const n = buildable.length;
  const slotH = n > 12 ? 38 : n > 9 ? 42 : 46;
  const slotFont = n > 12 ? 14 : n > 9 ? 17 : 20;
  // Sochilgan harflar ham shunga yarasha: pastda ular ikki qatorga
  // sig'ishi mumkin, lekin uch qatorga cho'zilib ketmasin.
  const tileH = n > 12 ? 44 : n > 9 ? 48 : 52;
  const tileFont = n > 12 ? 17 : n > 9 ? 19 : 21;

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{t.buildWord}</span>
        <span className="max-w-full break-words px-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
          {word.uz}
        </span>

        {/* Yig'ilayotgan so'z — DOIM BITTA QATORDA.
            Ilgari `flex-wrap` edi va uzun so'zlarda kataklar pastga tushib
            ketardi: so'z ikkiga bo'linib, qaysi harf qayerga tegishli
            ekani ko'rinmay qolardi. Endi kataklar bo'sh joyni teng bo'lib
            oladi (`flex-1`) va uzun so'zda o'zi kichrayadi. */}
        <div className="mt-3 flex w-full flex-nowrap items-center justify-center gap-[3px] px-1">
          {article && (
            <span className="mr-1 shrink-0 text-[17px] font-bold text-slate-400">{article}</span>
          )}
          {letters.map((ch, i) =>
            ch.trim() === "" ? (
              <span key={i} className="w-1.5 shrink-0" />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => filled[i] !== null && take(i)}
                disabled={!!picked || filled[i] === null}
                style={{ height: slotH, fontSize: slotFont }}
                className={
                  "grid min-w-0 flex-1 place-items-center rounded-[10px] border-2 font-extrabold transition " +
                  (filled[i] === null
                    ? "border-dashed border-slate-300 bg-white/40 text-transparent"
                    : wrong
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : picked
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-transparent bg-white text-slate-900 shadow-[0_4px_10px_-8px_rgba(15,60,80,0.9)]")
                }
              >
                {filled[i] ?? "·"}
              </button>
            ),
          )}
        </div>

        {/* Xato bo'lsa to'g'ri javob ko'rsatiladi */}
        {wrong && (
          <div className="mt-1 text-[13px] font-semibold text-slate-500">
            {t.correctAnswer}: <span className="font-extrabold text-slate-800">{word.de}</span>
          </div>
        )}
      </div>

      {/* Sochilgan harflar */}
      <div className="shrink-0">
        <div className="flex flex-wrap justify-center gap-2">
          {tiles.map((tile, ti) => (
            <button
              key={ti}
              type="button"
              onClick={() => put(ti)}
              disabled={!!picked || tile.slot !== null}
              style={{ height: tileH, minWidth: tileH - 8, fontSize: tileFont }}
              className={
                "grid place-items-center rounded-[14px] px-2 font-extrabold transition active:scale-95 " +
                (tile.slot !== null
                  ? "bg-white/40 text-transparent"
                  : "bg-white text-slate-900 shadow-[0_6px_16px_-10px_rgba(15,60,80,0.8)]")
              }
            >
              {tile.ch}
            </button>
          ))}
        </div>

        {/* Tozalash — hech narsa qo'yilmagan bo'lsa o'chiq turadi */}
        <button
          type="button"
          onClick={clear}
          disabled={!!picked || emptySlots.length === buildable.length}
          className="mt-4 w-full rounded-[16px] bg-white/70 py-3 text-[14px] font-bold transition active:scale-[0.985] disabled:opacity-40"
          style={{ color: accent.includes("gradient") ? "#c8790c" : accent }}
        >
          {t.clearLetters}
        </button>
      </div>
    </>
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

/* ── Bosqichlar orasi ── */
function StageBreak({
  t, accent, nextStage, onNext,
}: {
  t: StudentStrings;
  accent: string;
  nextStage: Stage;
  onNext: () => void;
}) {
  const name = nextStage === 2 ? t.stage2Name : nextStage === 3 ? t.stage3Name : t.stage4Name;
  const hint = nextStage === 2 ? t.stage2Hint : nextStage === 3 ? t.stage3Hint : t.stage4Hint;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-center">
      <span
        className="mb-5 grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_16px_34px_-16px_rgba(224,146,23,0.95)]"
        style={{ background: accent }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      </span>

      <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{t.stageDone}</div>
      <h2 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
        {t.stage} {nextStage} · {name}
      </h2>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-slate-500">{hint}</p>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 w-full max-w-[320px] rounded-[18px] py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(224,146,23,0.9)] transition active:scale-[0.985]"
        style={{ background: accent }}
      >
        {t.continueNext}
      </button>
    </div>
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
  // Aniqlik — birinchi urinishdan to'g'ri chiqqanlar ulushi. `right` uchala
  // bosqichdagi to'g'ri javoblar (ya'ni total*3), shuning uchun ma'noli
  // ko'rsatkich urinishlar soniga nisbatan.
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
