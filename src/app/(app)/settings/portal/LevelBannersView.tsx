"use client";

import { useRef, useState, useTransition } from "react";
import { saveLevelBanner } from "./actions";

// Kurs bannerlari — har daraja uchun bitta rasm. Rasm qo'yilgan daraja
// o'quvchi ilovasida shu rasm bilan ko'rinadi, qo'yilmagani avvalgidek
// rangli kartochka bo'lib qoladi.

export type BannerRow = { code: string; name: string; url: string | null };

export default function LevelBannersView({ rows, locale }: { rows: BannerRow[]; locale: string }) {
  const L = (uz: string, ru: string, en: string) => (locale === "ru" ? ru : locale === "uz" ? uz : en);
  const [items, setItems] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (code: string, file: File) => {
    setErr(null);
    setBusy(code);
    try {
      // Banner keng va past bo'ladi — brauzerda 1200px gacha kichraytiramiz
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "banner.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error("upload");

      const res = await saveLevelBanner(code, j.url);
      if (res.error) throw new Error(res.error);
      setItems((xs) => xs.map((x) => (x.code === code ? { ...x, url: j.url } : x)));
    } catch {
      setErr(L("Yuklab bo'lmadi", "Не удалось загрузить", "Upload failed"));
    } finally {
      setBusy(null);
    }
  };

  const clear = (code: string) => {
    setErr(null);
    start(async () => {
      const res = await saveLevelBanner(code, null);
      if (res.error) setErr(res.error);
      else setItems((xs) => xs.map((x) => (x.code === code ? { ...x, url: null } : x)));
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {L("Kurs bannerlari", "Баннеры курсов", "Course banners")}
        </h2>
        <p className="text-sm text-slate-500">
          {L(
            "Ilovadagi kurslar ro'yxatida daraja kartochkasi o'rniga shu rasm ko'rinadi. Rasm qo'yilmasa — rangli kartochka qoladi.",
            "В приложении вместо карточки уровня будет это изображение. Без него останется цветная карточка.",
            "Shown instead of the level card in the app. Without it the coloured card stays.",
          )}
        </p>
      </div>

      {err ? <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{err}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <div key={it.code} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="relative aspect-[16/7] bg-slate-100 dark:bg-slate-800">
              {it.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt={it.code} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-sm text-slate-400">
                  {L("Rasm yo'q", "Нет изображения", "No image")}
                </span>
              )}
              <span className="absolute left-2 top-2 rounded-lg bg-black/45 px-2 py-[2px] text-[11px] font-bold text-white backdrop-blur-sm">
                {it.code}
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5">
              <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{it.name}</div>
              <input
                ref={(el) => {
                  inputs.current[it.code] = el;
                }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(it.code, f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy === it.code}
                onClick={() => inputs.current[it.code]?.click()}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
              >
                {busy === it.code ? "…" : it.url ? L("Almashtirish", "Заменить", "Replace") : L("Yuklash", "Загрузить", "Upload")}
              </button>
              {it.url ? (
                <button
                  type="button"
                  onClick={() => clear(it.code)}
                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600"
                >
                  {L("O'chirish", "Удалить", "Remove")}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Banner uchun 1200px yetarli — katta suratni brauzerda kichraytiramiz
function shrink(f: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1200;
      const k = Math.min(1, max / im.width);
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.86);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    im.src = url;
  });
}
