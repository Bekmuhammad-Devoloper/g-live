"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

// Qo'ng'iroq yozuvi pleyeri — /api/telephony/recordings/<fayl>.wav dan real audio.
// Birinchi bosilganda fayl yuklanadi, to'lqin (waveform) haqiqiy signaldan hisoblanadi.
// Bo'sh yozuv (< ~100 bayt) yoki 404 — xato holati sifatida ko'rsatiladi (soxta audio yo'q).

const BAR_COUNT = 32;

// Brauzerdagi AudioContext limitiga tushib qolmaslik uchun bitta umumiy kontekst.
let sharedCtx: AudioContext | null = null;
function decoderCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new Ctx();
  return sharedCtx;
}

/** Yuklashdan oldingi barqaror (id bo'yicha) to'lqin — har renderda bir xil. */
function placeholderBars(seed: string, n = BAR_COUNT): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return 0.18 + ((h >> (i % 9)) % 70) / 100; // 0.18–0.88
  });
}

/** Dekodlangan audiodan haqiqiy amplituda ustunlari. */
function computeBars(buffer: AudioBuffer, n = BAR_COUNT): number[] {
  const raw = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(raw.length / n));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(raw[i * step + j] ?? 0);
    out.push(sum / step);
  }
  const max = Math.max(...out, 0.001);
  return out.map((v) => Math.max(0.08, v / max));
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type State = "idle" | "loading" | "ready" | "playing" | "error";

export default function Waveform({
  id,
  src,
  duration,
  timeLabel,
  locale,
}: {
  id: string;
  src: string;
  duration: number;
  timeLabel?: string;
  locale: Locale;
}) {
  const [state, setState] = useState<State>("idle");
  const [bars, setBars] = useState<number[]>(() => placeholderBars(id));
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration);
  const [size, setSize] = useState(0);
  const [errText, setErrText] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const load = useCallback(async (): Promise<string | null> => {
    const notFound = tr(locale, { uz: "Yozuv topilmadi", ru: "Запись не найдена", en: "Recording not found", de: "Aufnahme nicht gefunden" });
    const empty = tr(locale, { uz: "Yozuv bo'sh", ru: "Запись пуста", en: "Recording is empty", de: "Aufnahme ist leer" });
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) {
        setErrText(notFound);
        return null;
      }
      const blob = await res.blob();
      // WAV sarlavhasidan katta bo'lmagan fayl — bo'sh yozuv, ijro etilmaydi
      if (blob.size <= 100) {
        setErrText(empty);
        return null;
      }
      setSize(blob.size);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      // To'lqinni haqiqiy signaldan hisoblaymiz (dekodlanmasa — o'rnini bosuvchi qoladi)
      try {
        const ctx = decoderCtx();
        if (ctx) {
          const buf = await blob.arrayBuffer();
          const decoded = await ctx.decodeAudioData(buf.slice(0));
          setBars(computeBars(decoded));
          if (isFinite(decoded.duration) && decoded.duration > 0) setTotal(decoded.duration);
        }
      } catch {
        /* dekodlab bo'lmadi — o'rnini bosuvchi to'lqin qoladi */
      }
      return url;
    } catch {
      setErrText(notFound);
      return null;
    }
  }, [src, locale]);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) {
      setProgress(a.currentTime / (a.duration || 1));
      setCurrent(a.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const toggle = async () => {
    if (state === "playing") {
      audioRef.current?.pause();
      cancelAnimationFrame(rafRef.current);
      setState("ready");
      return;
    }
    if (state === "ready" && audioRef.current) {
      void audioRef.current.play();
      setState("playing");
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (state === "error") {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setErrText("");
    }

    setState("loading");
    const url = await load();
    if (!url) {
      setState("error");
      return;
    }
    const audio = new Audio(url);
    audio.onended = () => {
      setState("ready");
      setProgress(0);
      setCurrent(0);
      cancelAnimationFrame(rafRef.current);
    };
    audio.onerror = () => {
      setErrText(tr(locale, { uz: "Ijro etib bo'lmadi", ru: "Не удалось воспроизвести", en: "Playback failed", de: "Wiedergabe fehlgeschlagen" }));
      setState("error");
    };
    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) setTotal(audio.duration);
    };
    audioRef.current = audio;
    void audio.play();
    setState("playing");
    rafRef.current = requestAnimationFrame(tick);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || state === "idle" || state === "loading" || state === "error") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = x * (a.duration || 0);
    setProgress(x);
    setCurrent(a.currentTime);
  };

  const playing = state === "playing";
  const shown = playing || (state === "ready" && progress > 0) ? current : total;
  const playLabel = playing
    ? tr(locale, { uz: "Pauza", ru: "Пауза", en: "Pause", de: "Pause" })
    : tr(locale, { uz: "Ijro etish", ru: "Воспроизвести", en: "Play", de: "Abspielen" });

  return (
    <div className="inline-flex min-w-[220px] max-w-[300px] select-none items-center gap-2.5 rounded-2xl bg-[#2B5278] px-3 py-2">
      <button
        onClick={toggle}
        disabled={state === "loading"}
        title={state === "error" ? tr(locale, { uz: "Qayta urinish", ru: "Повторить", en: "Retry", de: "Erneut versuchen" }) : playLabel}
        aria-label={playLabel}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 disabled:opacity-60"
      >
        {state === "loading" ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : state === "error" ? (
          <Icon name="alert" className="h-4 w-4 text-red-300" />
        ) : (
          <Icon name={playing ? "pause" : "play"} className="h-4 w-4 text-white" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex h-[28px] cursor-pointer items-end gap-[1.5px]" onClick={seek} role="presentation">
          {bars.map((h, i) => {
            const active = (state === "playing" || state === "ready") && i / bars.length <= progress;
            return (
              <span
                key={i}
                className="flex-1 rounded-full transition-colors duration-100"
                style={{
                  height: `${Math.max(3, h * 28)}px`,
                  backgroundColor: active ? "#A8D8EA" : "rgba(255,255,255,0.35)",
                }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-white/70">
            {state === "error" ? (
              <span className="text-red-300">{errText}</span>
            ) : (
              <>
                {fmtDur(shown)}
                {size > 0 && <span className="ml-1.5 text-white/50">{fmtSize(size)}</span>}
              </>
            )}
          </span>
          {timeLabel && <span className="shrink-0 text-[10px] text-white/50">{timeLabel}</span>}
        </div>
      </div>
    </div>
  );
}
