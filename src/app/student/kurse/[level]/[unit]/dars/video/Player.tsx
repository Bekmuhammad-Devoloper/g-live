"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { markLessonWatched } from "../../actions";
import { protectScreen, unprotectScreen } from "@/lib/screenGuard";

type Mode = "file" | "embed" | "link" | "none";

export default function Player({
  mode, src, poster = null, lessonId, watched, playLabel, closeLabel, rotateHint,
}: {
  mode: Mode;
  src: string | null;
  poster?: string | null;
  lessonId: string;
  watched: boolean;
  playLabel: string;
  closeLabel: string;
  rotateHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  useEffect(() => setMounted(true), []);

  const mark = useCallback(() => {
    if (sent.current || watched) return;
    sent.current = true;
    void markLessonWatched(lessonId);
  }, [lessonId, watched]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
    }
    try {
      (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
    } catch {
    }
  }, []);

  const play = async () => {
    flushSync(() => setOpen(true));
    try {
      const box = boxRef.current;
      if (box && !document.fullscreenElement) await box.requestFullscreen();
    } catch {
    }
    try {
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
    }
    mark();
  };

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!open) return;
    void protectScreen();
    return () => { void unprotectScreen(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={play}
        disabled={mode === "none" || !src}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[14px] font-extrabold text-slate-900 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-50"
      >
        {playLabel}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </button>

      {open && mounted &&
        createPortal(
          <div ref={boxRef} className="fixed inset-0 z-[60] bg-black" role="dialog" aria-modal="true">
            {mode === "file" && src ? (
              <video
                src={src}
                poster={poster ?? undefined}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full bg-black object-contain"
                onEnded={mark}
              />
            ) : mode === "embed" && src ? (
              <iframe
                src={`${src}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={playLabel}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : null}

            {portrait && (
              <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                <span className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm">
                  {rotateHint}
                </span>
              </div>
            )}

          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          </div>,
          document.body,
        )}
    </>
  );
}
