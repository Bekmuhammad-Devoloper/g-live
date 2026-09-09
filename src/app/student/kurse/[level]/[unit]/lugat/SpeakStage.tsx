"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentStrings } from "../../../../_i18n";
import { isNativeApp, listenNative, stopNative } from "@/lib/nativeSpeech";

// Talaffuz bosqichi — o'quvchi so'zni ovoz chiqarib aytadi.
//
// FAQAT ANDROID ILOVASIDA. Nutqni telefonning o'zi taniydi
// (NativeSpeechPlugin): bepul, kvotasiz, odatda bir soniyada, o'quvchining
// ovozi telefondan chiqmaydi — serverga faqat tanilgan MATN boradi va
// solishtirish o'sha yerda (lib/pronounce.ts).
//
// ILGARI zaxira yo'l bor edi: brauzerda yozib olib, Gemini'ga yuborish.
// U OLIB TASHLANDI, chunki:
//   · noto'g'ri aytilganini "to'g'ri" deb o'tkazardi (o'ylab topadi —
//     ohangga, shovqinga, hatto jimlikka ham so'z "eshitardi"). Foydalanuvchi
//     buni ikki marta ko'rdi. Tekshirmagan holatdan noto'g'ri tekshirgani
//     yomonroq.
//   · bepul kvota kuniga 20 ta so'rov, 5 s audioga ~30 s kutish.
// Brauzerda mashq uch bosqichda tugaydi (VocabTrainer `lastStage`).
// Bu komponent brauzerda umuman chizilmaydi; ehtiyot uchun chizilsa ham
// "faqat ilovada" deb aytadi va o'tkazib yuborishni taklif qiladi.

type Phase = "idle" | "listening" | "checking" | "result" | "error";

export default function SpeakStage({
  word, wordIndex, lessonId, t, accent, picked, onAnswer, onSkip,
}: {
  /** Aytilishi kerak bo'lgan so'z, artikli bilan */
  word: string;
  /** Darsdagi tartib raqami — server maqsad so'zni SHUNDAN aniqlaydi */
  wordIndex: number;
  lessonId: string;
  t: StudentStrings;
  accent: string;
  picked: string | null;
  onAnswer: (ok: boolean, mark: string) => void;
  /** Nutq tanish umuman ishlamasa — bosqichni o'tkazib yuborish */
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  /** Nima uchun ishlamagani — xato ostida kichik yozuvda (masalan "err_5") */
  const [diag, setDiag] = useState<string | null>(null);

  // Brauzerda bu bosqich ma'nosiz — darhol aytamiz
  useEffect(() => {
    let cancelled = false;
    void isNativeApp().then((inApp) => {
      if (cancelled || inApp) return;
      setCanSkip(true);
      setProblem(t.speechOnlyInApp);
      setPhase("error");
    });
    return () => { cancelled = true; };
  }, [t]);

  /** Tanilgan matnni serverga yuboradi — solishtirish u yerda */
  const send = useCallback(async (transcript: string) => {
    setPhase("checking");
    try {
      const fd = new FormData();
      fd.set("transcript", transcript);
      fd.set("lessonId", lessonId);
      fd.set("wordIndex", String(wordIndex));
      // Muddat: sekin tarmoqda so'rov osilib qolsa tugma abadiy o'chib qolardi
      const res = await fetch("/api/pronounce", { method: "POST", body: fd, signal: AbortSignal.timeout(30_000) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; heard?: string; error?: string };
      if (data.error) { setDiag(data.error); setProblem(t.speakUnavailable); setPhase("error"); return; }
      setHeard(data.heard ?? null);
      setPhase("result");
      onAnswer(!!data.ok, data.heard || "?");
    } catch {
      setDiag("network");
      setProblem(t.speakUnavailable);
      setPhase("error");
    }
  }, [lessonId, wordIndex, t, onAnswer]);

  const start = useCallback(async () => {
    if (phase !== "idle" && phase !== "error") return;
    if (canSkip && problem === t.speechOnlyInApp) return; // brauzer — urinmaymiz
    setProblem(null);
    setHeard(null);
    setDiag(null);
    setPhase("listening");
    navigator.vibrate?.(10);

    const r = await listenNative("de-DE");

    if (!r) {
      // Plagin yo'q: ilovada bu eski APK
      setDiag("no_plugin");
      setCanSkip(true);
      setProblem(t.updateApp);
      setPhase("error");
      return;
    }
    if ("error" in r) {
      if (r.error === "denied") { setCanSkip(true); setProblem(t.micDenied); }
      else if (r.error === "no_match") setProblem(t.noVoice);
      else if (r.error === "network") { setDiag(r.error); setProblem(t.speakUnavailable); }
      else {
        // Xizmat nosoz / til yo'q / oyna ham ochilmadi — sababi qavsda
        setDiag(r.error);
        setCanSkip(true);
        setProblem(t.speechServiceMissing);
      }
      setPhase("error");
      return;
    }
    if (!r.text.trim()) { setProblem(t.noVoice); setPhase("error"); return; }
    await send(r.text);
  }, [phase, canSkip, problem, t, send]);

  const stop = useCallback(() => { void stopNative(); }, []);

  const ok = phase === "result" && picked !== null && heard !== null;
  const wrong = phase === "result" && picked !== null && !ok;

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{t.sayWord}</span>
        <span className="max-w-full break-words px-2 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
          {word}
        </span>

        {phase === "result" && heard && (
          <div className="mt-1 text-[13.5px] text-slate-500">
            {t.heardYou}: <span className="font-extrabold text-slate-800">{heard}</span>
          </div>
        )}
        {phase === "error" && problem && (
          <div className="mt-1 max-w-[280px] text-[13.5px] font-semibold text-rose-600">{problem}</div>
        )}
        {/* Texnik sabab — qurilmasiz turib nima bo'lganini bilishning yagona yo'li */}
        {phase === "error" && diag && (
          <div className="text-[11px] font-medium text-slate-400">({diag})</div>
        )}
      </div>

      {/* ── Mikrofon tugmasi ── */}
      <div className="flex shrink-0 flex-col items-center gap-3">
        <button
          type="button"
          onClick={phase === "listening" ? stop : start}
          disabled={phase === "checking" || phase === "result"}
          aria-label={t.sayWord}
          className={
            "grid h-[92px] w-[92px] place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-60 " +
            (phase === "listening" ? "animate-pulse" : "")
          }
          style={{
            background: wrong ? "#e11d48" : ok ? "#059669" : accent,
            boxShadow: "0 14px 30px -14px rgba(15,60,80,0.85)",
          }}
        >
          {phase === "checking" ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="animate-spin">
              <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" />
            </svg>
          ) : phase === "result" ? (
            ok ? (
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4.5 12.5 5 5 10-11" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )
          ) : phase === "listening" ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2.5" />
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2.6" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
              <path d="M12 17.5V21M8.6 21h6.8" />
            </svg>
          )}
        </button>

        <span className="min-h-[20px] text-[13px] font-semibold text-slate-500">
          {phase === "listening" ? t.micListening : phase === "checking" ? t.micChecking : phase === "idle" || phase === "error" ? t.tapToSpeak : ""}
        </span>

        {/* Nutq tanish umuman ishlamasa — bosqichni o'tkazib yuborish.
            O'quvchining aybi emas, shu sabab uni cheksiz to'sib qo'ymaymiz. */}
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-1 rounded-[14px] px-4 py-2 text-[13px] font-bold text-slate-500 underline underline-offset-4"
          >
            {t.skipStage}
          </button>
        )}
      </div>
    </>
  );
}
