"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createManualPayment, type PayState } from "./actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, label, type Locale } from "@/lib/constants";
import { getT } from "@/lib/i18n";
import { tr } from "@/lib/tr";

export default function NewPaymentForm({
  locale,
  students,
}: {
  locale: Locale;
  students: { id: string; fullName: string }[];
}) {
  const t = getT(locale);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PayState, FormData>(createManualPayment, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        + {t("pay.new")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Yonboshdan ochiladigan panel (ilovadagi boshqa formalar kabi) */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <form ref={formRef} action={action} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col space-y-3 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-pop dark:border-white/10 dark:bg-[#15243d]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t("pay.new")}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.student")} <span className="text-red-500">*</span></label>
              <select name="studentId" required className={input} defaultValue="">
                <option value="" disabled>—</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("common.amount")} ({tr(locale, { uz: "so'm", ru: "сум", en: "soʻm" })}) <span className="text-red-500">*</span></label>
                <input name="amount" type="number" min="1" step="10000" required className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.method")} <span className="text-red-500">*</span></label>
                <select name="method" required className={input} defaultValue="CASH">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(PAYMENT_METHOD_LABELS, m, locale)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.purpose")} <span className="text-red-500">*</span></label>
              <input name="purpose" required placeholder={tr(locale, { uz: "A1.2 kurs to'lovi", ru: "Оплата курса A1.2", en: "A1.2 course payment" })} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.docNumber")} <span className="text-red-500">*</span></label>
              <input name="docNumber" required placeholder="CHK-0003" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("common.note")}</label>
              <textarea name="note" rows={2} className={input} />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error === "forbidden" ? t("pay.noPermission") : tr(locale, { uz: "Barcha majburiy maydonlarni to'ldiring.", ru: "Заполните все обязательные поля.", en: "Fill in all required fields." })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? "..." : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
