"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { payOnline, type PayState } from "./actions";
import type { Locale } from "@/lib/constants";
import { getT } from "@/lib/i18n";
import { tr } from "@/lib/tr";

const ONLINE_METHODS = ["CLICK", "PAYME", "UZUM"];

export default function OnlinePaymentForm({
  locale,
  students,
}: {
  locale: Locale;
  students: { id: string; fullName: string }[];
}) {
  const t = getT(locale);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PayState, FormData>(payOnline, {});
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
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
        ⚡ {tr(locale, { uz: "Onlayn to'lov (demo)", ru: "Онлайн-платёж (демо)", en: "Online payment (demo)", de: "Online-Zahlung (Demo)" })}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <form ref={formRef} action={action} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{tr(locale, { uz: "Onlayn to'lov (provayder callback demo)", ru: "Онлайн-платёж (демо колбэка провайдера)", en: "Online payment (provider callback demo)", de: "Online-Zahlung (Demo-Callback des Anbieters)" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              {tr(locale, { uz: "Bu haqiqiy provayder muvaffaqiyatli javobini simulyatsiya qiladi: status avtomatik «To'landi» bo'ladi va chek beriladi.", ru: "Это симулирует успешный ответ реального провайдера: статус автоматически станет «Оплачено» и будет выдан чек.", en: "This simulates a real provider's successful response: the status automatically becomes «Paid» and a receipt is issued.", de: "Dies simuliert eine erfolgreiche Antwort eines echten Anbieters: Der Status wird automatisch auf «Bezahlt» gesetzt, und ein Beleg wird ausgestellt." })}
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.student")} <span className="text-red-500">*</span></label>
              <select name="studentId" required className={input} defaultValue="">
                <option value="" disabled>—</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("common.amount")} ({tr(locale, { uz: "so'm", ru: "сум", en: "soʻm", de: "UZS" })}) <span className="text-red-500">*</span></label>
                <input name="amount" type="number" min="1" step="10000" required className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.method")}</label>
                <select name="method" className={input} defaultValue="CLICK">
                  {ONLINE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("pay.purpose")} <span className="text-red-500">*</span></label>
              <input name="purpose" required placeholder={tr(locale, { uz: "A1.2 kurs to'lovi", ru: "Оплата курса A1.2", en: "A1.2 course payment", de: "A1.2-Kursgebühr" })} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Tranzaksiya ID (ixtiyoriy — idempotentlikni sinash uchun)", ru: "ID транзакции (необязательно — для проверки идемпотентности)", en: "Transaction ID (optional — to test idempotency)", de: "Transaktions-ID (optional — zum Testen der Idempotenz)" })}</label>
              <input name="transactionId" placeholder="ONLINE-TEST-001" className={input} />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error === "duplicate"
                  ? tr(locale, { uz: "Bu tranzaksiya ID allaqachon hisoblangan (ikki marta hisoblanish bloklandi).", ru: "Этот ID транзакции уже учтён (повторный учёт заблокирован).", en: "This transaction ID has already been processed (double-processing blocked).", de: "Diese Transaktions-ID wurde bereits verarbeitet (doppelte Verarbeitung blockiert)." })
                  : state.error === "forbidden"
                  ? t("pay.noPermission")
                  : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "The data is incomplete.", de: "Die Daten sind unvollständig." })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? "..." : tr(locale, { uz: "To'lash (demo)", ru: "Оплатить (демо)", en: "Pay (demo)", de: "Bezahlen (Demo)" })}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
