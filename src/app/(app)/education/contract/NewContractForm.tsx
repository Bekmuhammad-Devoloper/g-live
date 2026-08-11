"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { createContractTemplate, type FormState } from "./actions";
import { CONTRACT_TEMPLATE_TYPES, CONTRACT_TEMPLATE_TYPE_LABELS, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";

export default function NewContractForm({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createContractTemplate, {});
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const label = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
  const input = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        ref={formRef}
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[460px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi shartnoma", ru: "Новый договор", en: "New contract" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={label}>{tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title" })} <span className="text-rose-500">*</span></label>
            <input name="title" required placeholder={tr(locale, { uz: "O'quv shartnomasi 2026", ru: "Учебный договор 2026", en: "Education contract 2026" })} className={input} />
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Shartnoma turi", ru: "Тип договора", en: "Contract type" })} <span className="text-rose-500">*</span></label>
            <select name="type" required className={input} defaultValue="STANDARD">
              {CONTRACT_TEMPLATE_TYPES.map((v) => <option key={v} value={v}>{CONTRACT_TEMPLATE_TYPE_LABELS[v][locale]}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Shartnoma matni", ru: "Текст договора", en: "Contract text" })}</label>
            <textarea name="content" rows={8} placeholder={tr(locale, { uz: "Shartnoma shabloni matnini kiriting...", ru: "Введите текст шаблона договора...", en: "Enter the contract template text..." })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })}</label>
            <input name="note" placeholder={tr(locale, { uz: "Ichki izoh (ixtiyoriy)", ru: "Внутренний комментарий (необязательно)", en: "Internal note (optional)" })} className={input} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            {tr(locale, { uz: "Faol (foydalanishga tayyor)", ru: "Активен (готов к использованию)", en: "Active (ready to use)" })}
          </label>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "The data is incomplete." })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
          </button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
