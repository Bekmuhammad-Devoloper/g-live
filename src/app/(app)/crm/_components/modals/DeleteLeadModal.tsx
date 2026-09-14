"use client";

import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";

// Lidni Kanbandan to'g'ridan-to'g'ri o'chirish uchun tasdiqlash oynasi.
// To'liq sahifadagi (ism yozib tasdiqlanadigan) o'chirishdan farqli —
// tezkor: ikkinchi bosish yetarli. Faqat direktor / o'rinbosari / admin.
export default function DeleteLeadModal({
  locale, open, leadName, pending, onClose, onConfirm,
}: {
  locale: Locale;
  open: boolean;
  leadName: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-500">
            <Icon name="trash" className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {tr(locale, { uz: "Lidni o'chirish", ru: "Удалить лид", en: "Delete lead", de: "Lead löschen" })}
            </h3>
            <p className="truncate text-xs text-slate-400">{leadName}</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {tr(locale, {
            uz: "Lid faoliyat tarixi bilan birga butunlay o'chiriladi va qaytarib bo'lmaydi. Qo'ng'iroq yozuvlari saqlanib qoladi.",
            ru: "Лид будет удалён безвозвратно вместе с историей действий. Записи звонков сохранятся.",
            en: "The lead and its activity history will be permanently deleted. Call records are kept.",
            de: "Der Lead wird samt Aktivitätsverlauf endgültig gelöscht. Anrufaufzeichnungen bleiben erhalten.",
          })}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          >
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            autoFocus
            className="flex-[1.4] rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending
              ? tr(locale, { uz: "O'chirilmoqda…", ru: "Удаление…", en: "Deleting…", de: "Wird gelöscht…" })
              : tr(locale, { uz: "Ha, o'chirilsin", ru: "Да, удалить", en: "Yes, delete", de: "Ja, löschen" })}
          </button>
        </div>
      </div>
    </div>
  );
}
