"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";
import { getLevelTestQr, type LevelTestQr } from "../../actions";

/**
 * "Daraja testi" ustunidagi QR oynasi.
 * Lid telefonida skan qiladi → ilovaning ochiq /daraja-testi sahifasi ochiladi;
 * natija CRM'ga avtomatik tushadi (lid "Daraja testi" ustuniga o'tadi).
 */
export default function LevelTestQrModal({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<LevelTestQr | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData(null); setCopied(false);
    getLevelTestQr().then(setData);
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    if (!data?.url) return;
    try { await navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600">
            <Icon name="qr" className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Daraja testi", ru: "Тест уровня", en: "Level test", de: "Einstufungstest" })}</h3>
            <p className="text-xs text-slate-400">{tr(locale, { uz: "Lid skan qiladi → testni topshiradi → natija shu ustunga tushadi", ru: "Лид сканирует → проходит тест → результат попадает в этот столбец", en: "The lead scans it, takes the test, and the result lands in this column", de: "Der Lead scannt, macht den Test, das Ergebnis landet in dieser Spalte" })}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {!data ? (
          <div className="grid h-56 place-items-center text-sm text-slate-400">{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading...", de: "Wird geladen..." })}</div>
        ) : (
          <div className="text-center">
            {data.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qr} alt="QR" className="mx-auto h-56 w-56 rounded-lg bg-white" />
            ) : (
              <p className="py-8 text-sm text-rose-500">
                {data.error === "forbidden"
                  ? tr(locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "Not allowed", de: "Keine Berechtigung" })
                  : tr(locale, { uz: "QR yaratib bo'lmadi", ru: "Не удалось создать QR", en: "Failed to generate QR", de: "QR-Code konnte nicht erstellt werden" })}
              </p>
            )}
            <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{data.url}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {data.qr && (
                <a href={data.qr} download="daraja-testi-qr.png" className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700">
                  <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "PNG yuklab olish", ru: "Скачать PNG", en: "Download PNG", de: "PNG herunterladen" })}
                </a>
              )}
              <button onClick={copy} className="btn-ghost">
                <Icon name="copy" className="h-4 w-4" /> {copied ? tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }) : tr(locale, { uz: "Havolani nusxalash", ru: "Копировать ссылку", en: "Copy link", de: "Link kopieren" })}
              </button>
              <a href={data.url} target="_blank" rel="noreferrer" className="btn-ghost">
                <Icon name="link" className="h-4 w-4" /> {tr(locale, { uz: "Sahifani ochish", ru: "Открыть страницу", en: "Open page", de: "Seite öffnen" })}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
