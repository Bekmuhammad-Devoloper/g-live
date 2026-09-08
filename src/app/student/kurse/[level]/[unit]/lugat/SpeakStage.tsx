"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentStrings } from "../../../../_i18n";
import { listenNative, nativeSpeechAvailable, stopNative } from "@/lib/nativeSpeech";

// Talaffuz bosqichi — o'quvchi so'zni ovoz chiqarib aytadi.
//
// IKKI YO'L BOR va birinchisi afzal:
//
//   1. ANDROIDNING O'ZI taniydi (NativeSpeechPlugin). Bepul, kvotasiz,
//      odatda bir soniyada va o'quvchining ovozi telefondan umuman
//      chiqmaydi — serverga faqat tanilgan MATN boradi.
//
//   2. Yozib olib, serverga yuborish (Gemini). Brauzer uchun va nutq
//      tanish xizmati yo'q telefonlar uchun zaxira.
//
// Nega birinchisi kerak bo'ldi: Gemini bepul kvotasi KUNIGA 20 ta so'rov
// (quotaValue 20). Bitta o'quvchi bitta darsni mashq qilsa 10 tasi ketadi
// — 125 o'quvchi uchun mutlaqo yetmaydi. Ustiga, 5 soniyalik yozuvga
// ~30 soniya javob kutilardi.
//
// NEGA WAV. Brauzer MediaRecorder bilan `audio/webm` yozadi, Gemini esa
// hujjatlarida WAV/MP3/OGG/FLAC ni sanaydi. Formatni serverda o'girish
// uchun ffmpeg kerak bo'lardi. Shu sabab yozuv brauzerning O'ZIDA WAV ga
// o'giriladi: MediaRecorder bilan yoziladi, keyin `decodeAudioData` orqali
// PCM ga ochiladi, 16 kHz mono ga siqiladi va WAV qilib yig'iladi.
// 5 soniyalik yozuv ~160 KB — mobil internetda ham sezilmaydi.
//
// NEGA OVOZ KUCHI O'LCHANADI. Sinovda Gemini MUTLAQ JIMLIKKA ham
// "Guten Tag" deb javob berdi. Ya'ni jim turib ham bosqichni o'tib ketish
// mumkin bo'lardi. Shu sabab yozuvda haqiqatan gapirilganini o'zimiz
// tekshiramiz. Bu yerdagi tekshiruv — tezkor javob uchun (server so'ralmaydi);
// haqiqiy himoya serverda, chunki bu yerdagisini chetlab o'tish mumkin.

const SAMPLE_RATE = 16000;
const MAX_MS = 6000;
/** Ovoz bor deb hisoblanadigan eng past kuch (~ -34 dB) */
const VOICE_RMS = 0.02;
/** Kamida shuncha 20 ms li bo'lakda ovoz bo'lsin (250 ms) */
const VOICE_FRAMES = 12;

type Phase = "idle" | "recording" | "checking" | "result" | "error";

/** Namuna chastotasini pasaytiradi — o'rtacha qiymat bilan */
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

/** 16-bit mono WAV yig'adi */
function encodeWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buf);
  const put = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  put(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  put(8, "WAVE");
  put(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);   // bayt/soniya
  view.setUint16(32, 2, true);          // blok
  view.setUint16(34, 16, true);         // bit
  put(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let o = 44;
  for (const s of pcm) {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Yozuvda gapirilganmi — 20 ms li bo'laklar bo'yicha */
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
  /** Mikrofon umuman ishlamasa — bosqichni o'tkazib yuborish */
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  /** Androidning o'z nutq tanish tizimi mavjudmi. null — hali aniqlanmadi */
  const [native, setNative] = useState<boolean | null>(null);

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

  // Qaysi yo'l borligini bir marta aniqlaymiz
  useEffect(() => {
    let cancelled = false;
    void nativeSpeechAvailable().then((v) => { if (!cancelled) setNative(v); });
    return () => { cancelled = true; };
  }, []);

  /** Yozuvni yoki tanilgan matnni serverga yuboradi va javobni ko'rsatadi */
  const send = useCallback(async (payload: { wav: Blob } | { transcript: string }) => {
    setPhase("checking");
    try {
      const fd = new FormData();
      if ("wav" in payload) fd.set("audio", payload.wav, "speech.wav");
      else fd.set("transcript", payload.transcript);
      fd.set("lessonId", lessonId);
      fd.set("wordIndex", String(wordIndex));

      const res = await fetch("/api/pronounce", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; heard?: string; error?: string };

      if (data.error === "no_voice") { setProblem(t.noVoice); setPhase("error"); return; }
      if (data.error) { setProblem(t.speakUnavailable); setPhase("error"); return; }

      setHeard(data.heard ?? null);
      setPhase("result");
      onAnswer(!!data.ok, data.heard || "?");
    } catch {
      setProblem(t.speakUnavailable);
      setPhase("error");
    }
  }, [lessonId, wordIndex, t, onAnswer]);

  const stop = useCallback(() => {
    if (native) { void stopNative(); return; }
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, [native]);

  /** 1-yo'l: Androidning o'zi taniydi */
  const startNative = useCallback(async () => {
    setPhase("recording");
    navigator.vibrate?.(10);

    const r = await listenNative("de-DE");
    if (!r) {
      // Plagin yo'q (eski APK) — bu yo'lni butunlay unutamiz
      setNative(false);
      setPhase("idle");
      return;
    }
    if ("error" in r) {
      if (r.error === "denied") { setMicBlocked(true); setProblem(t.micDenied); }
      else if (r.error === "no_match") setProblem(t.noVoice);
      else if (r.error === "unavailable") {
        // Xizmat nosoz — zaxira yo'lga o'tamiz
        setNative(false);
        setPhase("idle");
        return;
      }
      else setProblem(t.speakUnavailable);
      setPhase("error");
      return;
    }
    if (!r.text.trim()) { setProblem(t.noVoice); setPhase("error"); return; }
    await send({ transcript: r.text });
  }, [t, send]);

  /** 2-yo'l: yozib olib, serverga yuborish */
  const startRecording = useCallback(async () => {
    let ms: MediaStream;
    try {
      ms = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      // Ruxsat berilmagan yoki mikrofon yo'q — o'quvchining aybi emas,
      // shuning uchun bosqichni o'tkazib yuborish taklif qilinadi.
      setMicBlocked(true);
      setProblem(t.micDenied);
      setPhase("error");
      return;
    }

    stream.current = ms;
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(ms);
    } catch {
      cleanup();
      setProblem(t.speakUnavailable);
      setPhase("error");
      return;
    }
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

        // Jim yozuvni serverga umuman yubormaymiz — javob darhol
        if (!hasVoice(pcm)) { setProblem(t.noVoice); setPhase("error"); return; }
        await send({ wav: encodeWav(pcm, SAMPLE_RATE) });
      } catch {
        setProblem(t.speakUnavailable);
        setPhase("error");
      }
    };

    rec.start();
    setPhase("recording");
    navigator.vibrate?.(10);
    stopTimer.current = setTimeout(stop, MAX_MS);
  }, [t, cleanup, send, stop]);

  /**
   * Tugma bosilganda: qaysi yo'l mavjud bo'lsa o'sha.
   *
   * DIQQAT: bu yerda "hali aniqlanmadi, keyinroq bosing" degan yo'l
   * BO'LMASLIGI kerak. Ilgari `native === null` bo'lganda jimgina
   * qaytilardi va foydalanuvchi uchun bu "tugma bosilmayapti" bo'lib
   * ko'rinardi — hech qanday belgi, hech qanday xabar. Endi aniqlanmagan
   * bo'lsa ham ish boshlanadi: yozib olish yo'li har doim mavjud.
   */
  const start = useCallback(async () => {
    if (phase !== "idle" && phase !== "error") return;
    setProblem(null);
    setHeard(null);
    if (native === true) await startNative();
    else await startRecording();
  }, [phase, native, startNative, startRecording]);

  const ok = picked !== null && heard !== null && phase === "result";
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
      </div>

      {/* ── Mikrofon tugmasi ── */}
      <div className="flex shrink-0 flex-col items-center gap-3">
        <button
          type="button"
          onClick={phase === "recording" ? stop : start}
          disabled={phase === "checking" || phase === "result"}
          aria-label={t.sayWord}
          className={
            "grid h-[92px] w-[92px] place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-60 " +
            (phase === "recording" ? "animate-pulse" : "")
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
          ) : phase === "recording" ? (
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
          {phase === "recording" ? t.micListening : phase === "checking" ? t.micChecking : phase === "idle" || phase === "error" ? t.tapToSpeak : ""}
        </span>

        {/* Mikrofon umuman ishlamasa — bosqichni o'tkazib yuborish.
            O'quvchining aybi emas, shu sabab uni cheksiz to'sib qo'ymaymiz. */}
        {micBlocked && (
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
