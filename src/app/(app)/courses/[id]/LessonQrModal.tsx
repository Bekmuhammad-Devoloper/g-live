"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import BrandedQr from "../../_components/BrandedQr";
import { getLessonQr, type LessonQr } from "./lessonActions";

/**
 * Dars QR kodi. O'quvchi telefonida skan qiladi:
 *   ilova yo'q → yuklab olish sahifasi; seans yo'q → kirish;
 *   faol o'quvchi → shu darsning videosi ilovada ochiladi.
 */
export default function LessonQrModal({ lessonId, title, order, locale, onClose }: { lessonId: string; title: string; order: number; locale: Locale; onClose: () => void }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [data, setData] = useState<LessonQr | null>(null);
  const [copied, setCopied] = useState(false);
  // Brendli QR canvas'da chizilgach PNG shu yerga tushadi (yuklab olish uchun)
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLessonQr(lessonId)
      .then((r) => { if (alive) setData(r); })
      .catch(() => { if (alive) setData({ url: "", modules: "", size: 0, error: "qr_failed" }); });
    return () => { alive = false; };
  }, [lessonId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    if (!data?.url) return;
    try { await navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* buferga ruxsat yo'q */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300">
            <Icon name="qr" className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{order}. {title}</h3>
            <p className="text-xs text-slate-400">{T("O'quvchi skan qiladi → dars videosi ilovada ochiladi", "Ученик сканирует → видеоурок открывается в приложении", "Student scans → the video lesson opens in the app", "Schüler scannt → die Videolektion öffnet sich in der App")}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {!data ? (
          <div className="grid h-56 place-items-center text-sm text-slate-400">{T("Yuklanmoqda...", "Загрузка...", "Loading...", "Wird geladen...")}</div>
        ) : (
          <div className="text-center">
            {data.modules ? (
              <BrandedQr modules={data.modules} size={data.size} className="mx-auto h-60 w-60 rounded-xl" onPng={setPng} />
            ) : (
              <p className="py-8 text-sm text-rose-500">
                {data.error === "forbidden" ? T("Ruxsat yo'q", "Нет доступа", "Not allowed", "Keine Berechtigung") : T("QR yaratib bo'lmadi", "Не удалось создать QR", "Failed to generate QR", "QR-Code konnte nicht erstellt werden")}
              </p>
            )}
            {data.url && <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{data.url}</p>}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {png && (
                <a href={png} download={`dars-${order}-qr.png`} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                  <Icon name="download" className="h-4 w-4" /> {T("PNG yuklab olish", "Скачать PNG", "Download PNG", "PNG herunterladen")}
                </a>
              )}
              {data.url && (
                <button onClick={copy} className="btn-ghost">
                  <Icon name="copy" className="h-4 w-4" /> {copied ? T("Nusxalandi", "Скопировано", "Copied", "Kopiert") : T("Havolani nusxalash", "Копировать ссылку", "Copy link", "Link kopieren")}
                </button>
              )}
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-left text-xs leading-relaxed text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              {T(
                "Ilova o'rnatilmagan bo'lsa — yuklab olish sahifasi, kirilmagan bo'lsa — kirish oynasi ochiladi. Video markazning istalgan guruhidagi faol o'quvchiga bepul ko'rinadi.",
                "Если приложение не установлено — откроется страница загрузки, если не выполнен вход — окно входа. Видео бесплатно доступно активному ученику любой группы центра.",
                "Without the app the download page opens; without a session the sign-in screen opens. The video is free for an active student of any group.",
                "Ohne App öffnet sich die Download-Seite, ohne Anmeldung der Login. Das Video ist für aktive Schüler jeder Gruppe kostenlos.",
              )}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
