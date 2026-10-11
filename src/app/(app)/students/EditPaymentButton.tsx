"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { PaymentRow } from "./PaymentPanel";
import { getPaymentForEdit, type PayRow } from "./actions";

/**
 * To'lovlar ro'yxati sahifalaridagi tahrirlash tugmasi: to'lovning joriy yozuvini yuklab,
 * o'quvchi oynasidagi bilan bir xil tahrirlash formasini oynada ochadi (sabab majburiy, audit).
 */
export default function EditPaymentButton({ paymentId, locale }: { paymentId: string; locale: Locale }) {
  const router = useRouter();
  const [row, setRow] = useState<PayRow | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();

  const open = () => {
    setErr(false);
    start(async () => {
      const r = await getPaymentForEdit(paymentId);
      if (r) setRow(r); else setErr(true);
    });
  };
  const close = () => setRow(null);

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50 dark:hover:bg-white/10"
      >
        <Icon name={pending ? "refresh" : "edit"} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      </button>
      {err && <span className="text-[11px] text-rose-500">{tr(locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No access", de: "Kein Zugriff" })}</span>}
      {row && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "To'lovni tahrirlash", ru: "Редактировать оплату", en: "Edit payment", de: "Zahlung bearbeiten" })}</h3>
              <button type="button" onClick={close} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <PaymentRow p={row} locale={locale} canEdit startEditing onCancel={close} onChanged={() => { close(); router.refresh(); }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
