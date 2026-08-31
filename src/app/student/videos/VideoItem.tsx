"use client";

import { useState } from "react";

// Ro'yxatdagi bitta material. Bosilguncha faqat rasm turadi —
// shu bilan sahifada o'nlab YouTube pleyeri birdan yuklanmaydi.

export type VVideo = {
  id: string;
  title: string;
  note: string | null;
  kind: string;
  thumb: string | null;
  embed: string | null;
  url: string;
};

export default function VideoItem({ v, openLabel }: { v: VVideo; openLabel: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_12px_28px_-16px_rgba(15,60,80,0.5)] ring-1 ring-slate-900/[0.05]">
      {open && v.embed ? (
        <iframe
          src={`${v.embed}?autoplay=1`}
          title={v.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full border-0 bg-black"
        />
      ) : v.embed ? (
        <button type="button" onClick={() => setOpen(true)} className="relative block aspect-video w-full bg-slate-900">
          {v.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <span className="absolute inset-0 bg-black/25" />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 pl-1 shadow-lg">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#0f172a"><path d="M8 5.2v13.6L19 12 8 5.2Z" /></svg>
          </span>
        </button>
      ) : (
        // Tanish bo'lmagan havola — yangi oynada ochamiz
        <a href={v.url} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center gap-2.5 bg-slate-900 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12 8 5.2Z" /></svg>
          <span className="text-[13.5px] font-bold">{openLabel}</span>
        </a>
      )}

      <div className="px-4 py-3">
        <h2 className="break-words text-[16px] font-extrabold leading-snug tracking-[-0.01em] text-slate-900">{v.title}</h2>
        {v.note ? <p className="mt-1 break-words text-[13.5px] leading-relaxed text-slate-500">{v.note}</p> : null}
      </div>
    </div>
  );
}
