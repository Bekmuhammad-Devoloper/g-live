"use client";

import { useState } from "react";

// Dars videosi — kartaning ustida sarlavha qatlami turadi, video
// o'ynatilganda u chetga chiqadi (ko'rishga xalaqit bermasin).

export type VideoMode = "file" | "embed" | "link" | "none";

function IcoPlay({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  );
}

export default function LessonVideo({
  mode, src, title, kicker, badge, pill, openLabel, emptyLabel,
}: {
  mode: VideoMode;
  src: string | null;
  title: string;
  /** Videodan yuqoridagi kichik yozuv — masalan "Dars 2/3" */
  kicker: string;
  /** O'ng yuqoridagi yorliq — "1.1" */
  badge: string;
  /** Sarlavha ostidagi tugmacha — dars nomi */
  pill: string;
  openLabel: string;
  emptyLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  // YouTube/Vimeo o'z sarlavhasini ko'rsatadi — ustiga yozmaymiz
  const showOverlay = mode !== "embed" && !playing;

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-slate-950 shadow-[0_22px_46px_-24px_rgba(9,32,53,0.85)] ring-1 ring-white/10">
      {mode === "file" && src ? (
        // Vertikal (telefonda olingan) video ham o'z nisbatida ko'rinsin
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="mx-auto block max-h-[58vh] w-auto max-w-full"
        />
      ) : mode === "embed" && src ? (
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      ) : mode === "link" && src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(125%_105%_at_50%_0%,#24455e_0%,#0a1622_100%)] transition active:scale-[0.99]"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/12 pl-1 text-white ring-1 ring-white/25 backdrop-blur-sm">
            <IcoPlay />
          </span>
          <span className="text-[13.5px] font-bold text-white/90">{openLabel}</span>
        </a>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(125%_105%_at_50%_0%,#24455e_0%,#0a1622_100%)]">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.07] pl-1 text-white/40 ring-1 ring-white/10">
            <IcoPlay />
          </span>
          <span className="max-w-[240px] text-center text-[12.5px] font-medium leading-snug text-white/45">{emptyLabel}</span>
        </div>
      )}

      {/* ── Ustki qatlam: bosishga xalaqit bermaydi ── */}
      <div
        className={
          "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/72 via-black/35 to-transparent px-5 pb-10 pt-4 transition-opacity duration-300 " +
          (showOverlay ? "opacity-100" : "opacity-0")
        }
      >
        <div className="text-[13px] font-medium italic text-white/70">{kicker}</div>
        <div className="mt-0.5 text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-white drop-shadow-sm">{title}</div>
        <span className="mt-2 inline-block max-w-full truncate rounded-full bg-[#2f77f2] px-3 py-[5px] text-[12.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(47,119,242,0.9)]">
          {pill}
        </span>
      </div>

      <span className="pointer-events-none absolute right-3.5 top-3.5 rounded-[12px] bg-[#2f77f2] px-2.5 py-1 text-[13px] font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(47,119,242,0.9)]">
        {badge}
      </span>
    </div>
  );
}
