"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { levelGradient } from "@/lib/levelColor";

// Bosh sahifadagi banner karuseli — bir nechta banner bo'lsa
// har 6 sekundda almashadi, nuqtaga bosib ham o'tish mumkin.

export type VBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  btnLabel: string | null;
  href: string | null;
  imageUrl: string | null;
  color: string;
};

export default function BannerCarousel({ items }: { items: VBanner[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const b = items[Math.min(i, items.length - 1)];

  const inner = (
    <>
      {b.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />
        </>
      ) : null}

      <div className="relative z-10 max-w-[70%]">
        <div className="text-[22px] font-extrabold leading-snug">{b.title}</div>
        {b.subtitle ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/85">{b.subtitle}</p> : null}
        {b.btnLabel ? (
          <span className="mt-4 inline-block rounded-2xl bg-white px-5 py-2.5 text-[14px] font-bold text-slate-900 shadow">
            {b.btnLabel}
          </span>
        ) : null}
      </div>
    </>
  );

  const cls =
    "relative flex min-h-[168px] flex-col justify-center overflow-hidden rounded-[26px] p-6 text-white shadow-[0_16px_32px_rgba(14,116,144,0.3)]";
  const style = b.imageUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(b.color) };

  return (
    <div className="relative">
      {b.href ? (
        <Link href={b.href} className={cls} style={style}>{inner}</Link>
      ) : (
        <div className={cls} style={style}>{inner}</div>
      )}

      {items.length > 1 ? (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1 backdrop-blur-sm">
          {items.map((x, k) => (
            <button
              key={x.id}
              type="button"
              aria-label={x.title}
              onClick={() => setI(k)}
              className={"h-1.5 rounded-full transition-all " + (k === i ? "w-5 bg-white" : "w-3 bg-white/50")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
