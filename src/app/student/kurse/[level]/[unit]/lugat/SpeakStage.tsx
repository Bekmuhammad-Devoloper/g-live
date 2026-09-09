"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentStrings } from "../../../../_i18n";
import { isNativeApp, listenNative, stopNative } from "@/lib/nativeSpeech";

// Talaffuz bosqichi — o'quvchi so'zni ovoz chiqarib aytadi.
//
// IKKI YO'L:
//   1. ANDROID ILOVASI — nutqni telefonning o'zi taniydi (NativeSpeechPlugin).
//      Bepul, kvotasiz, ovoz telefondan chiqmaydi; serverga faqat MATN boradi.
//   2. BRAUZER — yozib olinadi, WAV ga o'giriladi, serverga yuboriladi;
//      u yerda Gemini YOPIQ TANLOV bilan baholaydi (darsdagi so'zlar
//      ro'yxatidan qaysi biri aytilgani, yoki hech qaysi) va server uch
//      shartni birga tekshiradi. Ochiq transkripsiya o'ylab topardi —
//      shuning uchun bu ko'rinishga o'tildi.
//
// NEGA WAV. Brauzer MediaRecorder bilan webm yozadi; Gemini WAV ni aniq
// qabul qiladi. Yozuv brauzerning O'ZIDA o'giriladi (decodeAudioData →
// 16 kHz mono → WAV). 4 soniya ≈ 128 KB.
//
// NEGA OVOZ KUCHI O'LCHANADI. Gemini jimlikka ham so'z "eshitadi". Jim
// yozuv serverga umuman yuborilmaydi (server ham o'lchaydi — u haqiqiy
// himoya, bu esa tezkor javob uchun).

const SAMPLE_RATE = 16000;
/** Bitta so'z uchun 4 soniya yetarli; uzunroq yozuv — sekinroq javob */
const MAX_MS = 4000;
const VOICE_RMS = 0.02;
const VOICE_FRAMES = 12; // 20 ms li bo'laklar → 250 ms

type Phase = "idle" | "listening" | "checking" | "result" | "error";

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const put = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  put(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); put(8, "WAVE");
  put(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  put(36, "data"); v.setUint32(40, pcm.length * 2, true);
  let o = 44;
  for (const s of pcm) { const c = Math.max(-1, Math.min(1, s)); v.setInt16(o, c < 0 ? c * 0x8000 : c * 0x7fff, true); o += 2; }
  return new Blob([buf], { type: "audio/wav" });
}

function hasVoice(pcm: Float32Array): boolean {
  const frame = SAMPLE_RATE / 50;
  let loud = 0;
  for (let i = 0; i + frame <= pcm.length; i += frame) {
    let sum = 0;
    for (let j = 0; j < frame; j++) sum += pcm[i + j] * pcm[i + j];
    if (Math.sqrt(sum / frame) > VOICE_RMS) loud++;
  }
  return loud >= VOICE_FRAMES;
}

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
  /** Tekshiruv umuman ishlamasa — bosqichni o'tkazib yuborish */
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  /**
   * Serverning QARORI — to'g'rimi. Ilgari yashil/qizil rang "eshitilgan
   * matn bormi" ga qarab chizilardi: noto'g'ri aytilganda ham server rad
   * etardi-yu, tugma yashil bo'lib, so'z jimgina navbatga qaytardi. O'quvchi
   * buni "to'g'ri deb oldi" deb tushunardi.
   */
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  /** Texnik sabab — xato ostida kichik yozuvda (masalan "err_5", "quota") */
  const [diag, setDiag] = useState<string | null>(null);
  /** Ilovadamizmi — null: hali aniqlanmadi */
  const [inApp, setInApp] = useState<boolean | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    let cancelled = false;
    void isNativeApp().then((v) => { if (!cancelled) setInApp(v); });
    return () => { cancelled = true; };
  }, []);

  const showError = useCallback((msg: string, code?: string, skip = false) => {
    setProblem(msg);
    setDiag(code ?? null);
    if (skip) setCanSkip(true);
    setPhase("error");
  }, []);

  /** Yozuvni yoki tanilgan matnni serverga yuboradi — qaror u yerda */
  const send = useCallback(async (payload: { wav: Blob } | { transcript: string }) => {
    setPhase("checking");
    try {
      const fd = new FormData();
      if ("wav" in payload) fd.set("audio", payload.wav, "speech.wav");
      else fd.set("transcript", payload.transcript);
      fd.set("lessonId", lessonId);
      fd.set("wordIndex", String(wordIndex));
      // Muddat: so'rov osilib qolsa tugma abadiy o'chib qolardi
      const res = await fetch("/api/pronounce", { method: "POST", body: fd, signal: AbortSignal.timeout(40_000) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; heard?: string; error?: string };

      if (data.error === "no_voice") { showError(t.noVoice); return; }
      if (data.error === "quota") { showError(t.quotaReached, "quota", true); return; }
      if (data.error === "not_configured") { showError(t.speechOnlyInApp, "not_configured", true); return; }
      if (data.error) { showError(t.speakUnavailable, data.error); return; }

      setHeard(data.heard ?? null);
      setVerdict(!!data.ok);
      setPhase("result");
      navigator.vibrate?.(data.ok ? 8 : [12, 60, 12]);
      onAnswer(!!data.ok, data.heard || "?");
    } catch {
      showError(t.speakUnavailable, "network");
    }
  }, [lessonId, wordIndex, t, onAnswer, showError]);

  /** 2-yo'l (brauzer): yozib olib, serverga yuborish */
  const startRecording = useCallback(async () => {
    let ms: MediaStream;
    try {
      ms = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      showError(t.micDenied, "mic_denied", true);
      return;
    }
    stream.current = ms;
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(ms); } catch { cleanup(); showError(t.speakUnavailable, "no_recorder", true); return; }
    recorder.current = rec;

    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      cleanup();
      try {
        const raw = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await raw.arrayBuffer());
        const pcm = downsample(decoded.getChannelData(0), decoded.sampleRate, SAMPLE_RATE);
        void ctx.close();
        if (!hasVoice(pcm)) { showError(t.noVoice); return; }
        await send({ wav: encodeWav(pcm, SAMPLE_RATE) });
      } catch {
        showError(t.speakUnavailable, "decode");
      }
    };

    rec.start();
    setPhase("listening");
    navigator.vibrate?.(10);
    stopTimer.current = setTimeout(() => { if (recorder.current?.state === "recording") recorder.current.stop(); }, MAX_MS);
  }, [t, cleanup, send, showError]);

  /** 1-yo'l (ilova): telefonning o'zi taniydi */
  const startNative = useCallback(async () => {
    setPhase("listening");
    navigator.vibrate?.(10);
    const r = await listenNative("de-DE");

    if (!r) { showError(t.updateApp, "no_plugin", true); return; }
    if ("error" in r) {
      if (r.error === "denied") showError(t.micDenied, undefined, true);
      else if (r.error === "no_match") showError(t.noVoice);
      else if (r.error === "network") showError(t.speakUnavailable, r.error);
      else showError(t.speechServiceMissing, r.error, true); // sababi qavsda
      return;
    }
    if (!r.text.trim()) { showError(t.noVoice); return; }
    await send({ transcript: r.text });
  }, [t, send, showError]);

  const start = useCallback(async () => {
    if (phase !== "idle" && phase !== "error") return;
    setProblem(null); setHeard(null); setDiag(null); setVerdict(null);
    // Ilovada HAR DOIM telefonning o'zi; brauzerda yozib olish
    if (inApp ?? (await isNativeApp())) await startNative();
    else await startRecording();
  }, [phase, inApp, startNative, startRecording]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    void stopNative();
  }, []);

  // Rang faqat serverning qaroriga qarab — "eshitildi"ga emas
  const ok = phase === "result" && verdict === true;
  const wrong = phase === "result" && verdict === false;

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{t.sayWord}</span>
        <span className="max-w-full break-words px-2 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
          {word}
        </span>

        {phase === "result" && heard && (
          <div className={"mt-1 text-[13.5px] " + (wrong ? "text-rose-600" : "text-slate-500")}>
            {t.heardYou}: <span className={"font-extrabold " + (wrong ? "text-rose-700" : "text-emerald-700")}>{heard}</span>
          </div>
        )}
        {/* Xato bo'lsa — nima kutilgani aniq ko'rinsin, yasash bosqichidagidek */}
        {wrong && (
          <div className="text-[13px] font-semibold text-slate-500">
            {t.correctAnswer}: <span className="font-extrabold text-slate-800">{word}</span>
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
          style={{ background: wrong ? "#e11d48" : ok ? "#059669" : accent, boxShadow: "0 14px 30px -14px rgba(15,60,80,0.85)" }}
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
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
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

        {/* Tekshiruv umuman ishlamasa — o'quvchining aybi emas, to'sib qo'ymaymiz */}
        {canSkip && (
          <button type="button" onClick={onSkip} className="mt-1 rounded-[14px] px-4 py-2 text-[13px] font-bold text-slate-500 underline underline-offset-4">
            {t.skipStage}
          </button>
        )}
      </div>
    </>
  );
}
