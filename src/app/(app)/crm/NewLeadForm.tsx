"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createLead, type LeadState } from "./actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getT } from "@/lib/i18n";

const SOURCES = ["sayt", "ilova", "telegram", "telefon", "reklama", "tashrif"];

// Boshqariladigan (controlled) modal — trigger tugmasi tashqarida.
export default function NewLeadForm({
  locale,
  open,
  onClose,
  defaultStage = "NEW",
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  defaultStage?: string;
}) {
  const t = getT(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<LeadState, FormData>(createLead, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
      router.refresh();
    }
  }, [state.ok, router, onClose]);

  if (!open) return null;

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16 backdrop-blur-sm">
      <form ref={formRef} action={action} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("crm.newLead")}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name" })} <span className="text-red-500">*</span></label>
            <input name="fullName" required className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.phone")} <span className="text-red-500">*</span></label>
            <input name="phone" required placeholder="+998 __ ___ __ __" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.source")}</label>
            <select name="source" className={input} defaultValue="telegram">
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}</label>
            <input name="interestCourse" placeholder={tr(locale, { uz: "Nemis tili A1", ru: "Немецкий язык A1", en: "German A1" })} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.budget")} ({tr(locale, { uz: "so'm", ru: "сум", en: "UZS" })})</label>
            <input name="budget" type="number" min="0" step="10000" className={input} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("crm.stage")}</label>
            <select name="stage" className={input} defaultValue={defaultStage}>
              {LEAD_STAGES.map((st) => <option key={st} value={st}>{label(LEAD_STAGE_LABELS, st, locale)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t("common.note")}</label>
            <textarea name="note" rows={2} className={input} />
          </div>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error === "duplicate" ? tr(locale, { uz: "Bu telefon raqami bilan lid allaqachon mavjud (dublikat).", ru: "Лид с этим номером телефона уже существует (дубликат).", en: "A lead with this phone number already exists (duplicate)." }) : state.error === "forbidden" ? t("pay.noPermission") : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "The data is incomplete." })}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{t("common.cancel")}</button>
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "..." : t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
