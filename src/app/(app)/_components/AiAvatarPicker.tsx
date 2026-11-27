"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import type { AiAvatarState } from "@/lib/aiAvatarShared";
import { addAiAvatar, chooseAiAvatar, removeAiAvatar, type AiAvatarResult } from "../ai/avatarActions";
import { confirmDelete } from "./dialogs";
import { Icon } from "./Icon";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;
const OUT_SIZE = 320;

export function AiAvatar({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" draggable={false} className={cn("shrink-0 select-none rounded-full bg-white object-cover", className)} />;
}

async function squareImage(file: File): Promise<{ blob: Blob; name: string }> {
  const keep = { blob: file as Blob, name: file.name || "ai-avatar.png" };
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return keep;
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const size = Math.min(OUT_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return keep;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) * 0.3, side, side, 0, 0, size, size);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
    if (!blob || !blob.size) return keep;
    return { blob, name: blob.type === "image/webp" ? "ai-avatar.webp" : "ai-avatar.png" };
  } catch {
    return keep;
  }
}

export default function AiAvatarPicker({ state, locale, onChange, onClose }: {
  state: AiAvatarState;
  locale: Locale;
  onChange: (s: AiAvatarState) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  const apply = (r: AiAvatarResult) => {
    if (r.ok) {
      onChange(r.state);
      setErr(null);
      return;
    }
    setErr(
      r.error === "limit" ? L("Ko'pi bilan 24 ta rasm qo'shish mumkin", "Можно добавить не более 24 изображений", "You can add up to 24 images", "Maximal 24 Bilder möglich")
      : r.error === "bad_file" ? L("Fayl rasm emas yoki buzilgan", "Файл не является изображением или повреждён", "The file is not a valid image", "Die Datei ist kein gültiges Bild")
      : L("Ruxsat yo'q", "Нет доступа", "Not allowed", "Nicht erlaubt"),
    );
  };

  const pick = (src: string) => {
    if (src === state.chosen) return;
    onChange({ ...state, chosen: src });
    start(async () => apply(await chooseAiAvatar(src)));
  };

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type)) {
      setErr(L("Faqat PNG, JPG, WebP yoki GIF rasm qo'shish mumkin", "Можно добавить только PNG, JPG, WebP или GIF", "Only PNG, JPG, WebP or GIF images", "Nur PNG, JPG, WebP oder GIF"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr(L("Rasm hajmi 10 MB dan oshmasin", "Размер изображения не более 10 МБ", "Image must be under 10 MB", "Bild muss kleiner als 10 MB sein"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { blob, name } = await squareImage(file);
      const fd = new FormData();
      fd.append("file", blob, name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !j?.url) throw new Error("upload");
      apply(await addAiAvatar(j.url));
    } catch {
      setErr(L("Rasm yuklanmadi, qayta urinib ko'ring", "Не удалось загрузить изображение, попробуйте ещё раз", "Upload failed, please try again", "Hochladen fehlgeschlagen, bitte erneut versuchen"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (src: string) => {
    const ok = await confirmDelete(L("Bu rasm ro'yxatdan o'chirilsinmi?", "Удалить это изображение из списка?", "Remove this image from the list?", "Dieses Bild aus der Liste entfernen?"));
    if (!ok) return;
    start(async () => apply(await removeAiAvatar(src)));
  };

  return (
    <div className="animate-slide-up shrink-0 border-b border-slate-200/80 bg-white px-4 pb-4 pt-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#1c1b18]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{L("AI avatarini tanlang", "Выберите аватар AI", "Choose the AI avatar", "KI-Avatar wählen")}</div>
          <div className="text-[11px] text-slate-400">{L("Tanlangan rasm tugmada va suhbatda ko'rinadi", "Выбранное изображение показывается на кнопке и в чате", "The chosen image appears on the button and in the chat", "Das gewählte Bild erscheint auf der Schaltfläche und im Chat")}</div>
        </div>
        <button type="button" onClick={onClose} title={L("Yopish", "Закрыть", "Close", "Schließen")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {state.avatars.map((src) => {
          const active = src === state.chosen;
          return (
            <div key={src} className="relative">
              <button
                type="button"
                onClick={() => pick(src)}
                aria-pressed={active}
                className={cn(
                  "block rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-[#1c1b18]",
                  active ? "ring-[3px] ring-violet-500" : "opacity-90 hover:scale-105 hover:opacity-100 hover:ring-2 hover:ring-violet-300",
                )}
              >
                <AiAvatar src={src} className="h-14 w-14" />
              </button>
              {active && (
                <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-white ring-2 ring-white dark:ring-[#1c1b18]">
                  <Icon name="check" className="h-3 w-3" />
                </span>
              )}
              {src.startsWith("/uploads/") && (
                <button
                  type="button"
                  onClick={() => remove(src)}
                  title={L("O'chirish", "Удалить", "Remove", "Entfernen")}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 transition hover:bg-rose-500 hover:text-white dark:bg-slate-800 dark:ring-white/10"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title={L("Rasm qo'shish", "Добавить изображение", "Add image", "Bild hinzufügen")}
          className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-violet-300 text-violet-500 transition hover:border-violet-500 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
        >
          <Icon name={busy ? "refresh" : "plus"} className={cn("h-5 w-5", busy && "animate-spin")} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {L("O'zingiz yaratgan rasmni ham \"+\" orqali qo'shishingiz mumkin: PNG, JPG, WebP yoki GIF. Kvadrat rasm eng yaxshi chiqadi.", "Можно добавить и своё изображение через «+»: PNG, JPG, WebP или GIF. Лучше всего квадратное.", "You can also add your own image with \"+\": PNG, JPG, WebP or GIF. Square images look best.", "Über \"+\" können Sie auch ein eigenes Bild hinzufügen: PNG, JPG, WebP oder GIF. Quadratisch wirkt am besten.")}
      </p>
      {err && <p className="mt-2 text-[12px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
    </div>
  );
}
