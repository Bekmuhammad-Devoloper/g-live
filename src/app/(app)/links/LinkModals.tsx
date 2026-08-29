"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { platform } from "./platforms";
import { linkQrDataUrl } from "./actions";
import type { CreatedLink } from "./types";

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className={cn("w-full rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900", wide ? "max-w-lg" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function DeleteConfirmModal({ locale, kind, label, onCancel, onConfirm }: {
  locale: Locale; kind: "link" | "vacancy"; label: string; onCancel: () => void; onConfirm: () => void;
}) {
  const title = kind === "link"
    ? tr(locale, { uz: "Linkni o'chirish", ru: "Удалить ссылку", en: "Delete link", de: "Link löschen" })
    : tr(locale, { uz: "Vakansiyani o'chirish", ru: "Удалить вакансию", en: "Delete vacancy", de: "Stelle löschen" });
  const body = kind === "link"
    ? tr(locale, { uz: "Bu linkni o'chirganingizdan so'ng, u orqali ariza topshirish imkonsiz bo'ladi.", ru: "После удаления этой ссылки подать заявку через неё будет невозможно.", en: "Once this link is deleted, applications can no longer be submitted through it.", de: "Nachdem dieser Link gelöscht wurde, können darüber keine Bewerbungen mehr eingereicht werden." })
    : tr(locale, { uz: "Vakansiya va unga tegishli barcha linklar o'chiriladi. Ular orqali ariza topshirish imkonsiz bo'ladi.", ru: "Вакансия и все её ссылки будут удалены. Подать заявку через них будет невозможно.", en: "The vacancy and all of its links will be deleted. Applications can no longer be submitted through them.", de: "Die Stelle und alle zugehörigen Links werden gelöscht. Über sie können keine Bewerbungen mehr eingereicht werden." });

  return (
    <Shell title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
          <div>
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{tr(locale, { uz: "Diqqat!", ru: "Внимание!", en: "Warning!", de: "Achtung!" })}</p>
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{body}</p>
          </div>
        </div>
        <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{label}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
          </button>
          <button onClick={onConfirm} className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
            <Icon name="trash" className="h-4 w-4" /> {tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
          </button>
        </div>
      </div>
    </Shell>
  );
}

export function ResultLinksModal({ locale, links, origin, onClose }: { locale: Locale; links: CreatedLink[]; origin: string; onClose: () => void }) {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <Shell wide title={`✅ ${tr(locale, { uz: "Linklar yaratildi!", ru: "Ссылки созданы!", en: "Links created!", de: "Links erstellt!" })}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {links.length > 1
            ? tr(locale, { uz: `${links.length} ta platforma linki yaratildi. Har birini nusxalab kerakli platformaga joylashtiring:`, ru: `Создано ссылок: ${links.length}. Скопируйте каждую и разместите на нужной платформе:`, en: `${links.length} platform links created. Copy each one and place it on the right platform:`, de: `${links.length} Plattformlinks erstellt. Kopieren Sie jeden und fügen Sie ihn auf der richtigen Plattform ein:` })
            : tr(locale, { uz: "Link yaratildi. Nusxalab kerakli joyga joylashtiring:", ru: "Ссылка создана. Скопируйте и разместите её:", en: "Link created. Copy it and place it where needed:", de: "Link erstellt. Kopieren Sie ihn und fügen Sie ihn an der gewünschten Stelle ein:" })}
        </p>
        <div className="space-y-2">
          {links.map((cl, i) => {
            const p = platform(cl.platform);
            const url = `${origin}/apply/${cl.code}`;
            const isCopied = copied === i;
            return (
              <div key={cl.code} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-slate-800" style={{ background: `${p.color}14` }}>
                <div className="flex min-w-0 items-center gap-3">
                  <Icon name={p.icon} className="h-5 w-5 shrink-0" style={{ color: p.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: p.color }}>{p.label}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{url}</p>
                  </div>
                </div>
                <button
                  onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000); } catch { /* ignore */ } }}
                  className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    isCopied ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "border border-slate-200 bg-white text-slate-500 hover:text-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}
                >
                  <Icon name={isCopied ? "check" : "copy"} className="h-3.5 w-3.5" />
                  {isCopied ? tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }) : tr(locale, { uz: "Nusxalash", ru: "Копировать", en: "Copy", de: "Kopieren" })}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(locale, { uz: "Yopish", ru: "Закрыть", en: "Close", de: "Schließen" })}</button>
        </div>
      </div>
    </Shell>
  );
}

export function QrModal({ locale, code, onClose }: { locale: Locale; code: string; onClose: () => void }) {
  const [data, setData] = useState<{ url: string; qr: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { linkQrDataUrl(code).then((r) => ("qr" in r ? setData(r) : setErr(r.error))); }, [code]);

  return (
    <Shell title={tr(locale, { uz: "QR kod", ru: "QR код", en: "QR code", de: "QR-Code" })} onClose={onClose}>
      <div className="text-center">
        {err ? (
          <p className="py-8 text-sm text-rose-500">{err}</p>
        ) : !data ? (
          <div className="grid h-56 place-items-center text-sm text-slate-400">{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading...", de: "Wird geladen..." })}</div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.qr} alt={`QR: ${code}`} className="mx-auto h-56 w-56 rounded-lg" />
            <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{data.url}</p>
            <a href={data.qr} download={`qr-${code}.png`} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "PNG yuklab olish", ru: "Скачать PNG", en: "Download PNG", de: "PNG herunterladen" })}
            </a>
          </>
        )}
      </div>
    </Shell>
  );
}
