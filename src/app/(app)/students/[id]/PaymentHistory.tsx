"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { PAYMENT_METHOD_LABELS, label, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import EditPaymentButton from "../EditPaymentButton";
import { ReceiptModal } from "../PaymentPanel";
import { getPaymentReceipt, type ReceiptData } from "../actions";

export interface HistoryPay {
  id: string;
  amount: number;
  method: string;
  status: string;
  purpose: string | null;
  note: string | null;
  promoCode: string | null;
  discount: number;
  createdAt: string;
  author: string | null;
}

type Txt = { uz: string; ru: string; en: string; de: string };

const p2 = (n: number) => String(n).padStart(2, "0");
const day = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${day(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
const num = (n: number) => Math.abs(n).toLocaleString("ru-RU").replace(/ /g, " ");

function kindOf(p: HistoryPay): { label: Txt; badge: string; sign: string; amount: string } {
  switch (p.status) {
    case "PAID":
      return { label: { uz: "to'lov", ru: "оплата", en: "payment", de: "Zahlung" }, badge: "bg-emerald-500 text-white", sign: "+", amount: "text-emerald-600 dark:text-emerald-400" };
    case "PENDING":
      return { label: { uz: "qarz", ru: "долг", en: "charge", de: "Forderung" }, badge: "bg-slate-400 text-white dark:bg-white/20", sign: "−", amount: "text-slate-700 dark:text-slate-200" };
    case "ADJUST":
      return { label: { uz: "tuzatish", ru: "корректировка", en: "adjustment", de: "Korrektur" }, badge: "bg-sky-500 text-white", sign: p.amount > 0 ? "−" : "+", amount: "text-slate-700 dark:text-slate-200" };
    case "REFUNDED":
      return { label: { uz: "qaytarildi", ru: "возврат", en: "refund", de: "Erstattung" }, badge: "bg-orange-500 text-white", sign: "−", amount: "text-orange-600 dark:text-orange-400" };
    default:
      return { label: { uz: "bekor", ru: "отменён", en: "cancelled", de: "storniert" }, badge: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300", sign: "", amount: "text-slate-400" };
  }
}

function Note({ text, locale }: { text: string; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 90 || text.split("\n").length > 2;
  return (
    <div className="mt-1">
      <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-500 dark:text-slate-400", long && !open && "line-clamp-2")}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
        >
          {open ? tr(locale, { uz: "Kamroq", ru: "Свернуть", en: "Less", de: "Weniger" }) : tr(locale, { uz: "Ko'proq", ru: "Подробнее", en: "More", de: "Mehr" })}
        </button>
      )}
    </div>
  );
}

export default function PaymentHistory({ payments, locale, canEdit }: { payments: HistoryPay[]; locale: Locale; canEdit: boolean }) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [, start] = useTransition();
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  const print = (id: string) => {
    setBusy(id);
    setFailed(null);
    start(async () => {
      const r = await getPaymentReceipt(id).catch(() => null);
      setBusy(null);
      if (r) setReceipt(r);
      else setFailed(id);
    });
  };

  const th = "px-3 py-3 text-left text-[13px] font-semibold text-slate-800 dark:text-slate-200";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(th, "pl-4")}>{L("Sana", "Дата", "Date", "Datum")}</th>
            <th className={th}>{L("Turi", "Тип", "Type", "Typ")}</th>
            <th className={th}>{L("Miqdor", "Сумма", "Amount", "Betrag")}</th>
            <th className={th}>{L("Izoh", "Комментарий", "Note", "Notiz")}</th>
            <th className={th}>{L("Xodim", "Сотрудник", "Staff", "Mitarbeiter")}</th>
            <th className={cn(th, "pr-4")} />
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => {
            const k = kindOf(p);
            const td = cn("border-t border-slate-100 px-3 py-3.5 align-top dark:border-white/[0.06]", i % 2 === 0 && "bg-slate-50/80 dark:bg-white/[0.025]");
            return (
              <tr key={p.id}>
                <td className={cn(td, "whitespace-nowrap pl-4 text-[13.5px] font-medium tabular-nums text-slate-700 dark:text-slate-200")}>{day(p.createdAt)}</td>
                <td className={td}>
                  <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11.5px] font-semibold", k.badge)}>{tr(locale, k.label)}</span>
                </td>
                <td className={cn(td, "whitespace-nowrap text-[15px] font-semibold tabular-nums", k.amount)}>
                  <span className={cn(p.status === "CANCELLED" && "line-through")}>{k.sign}{num(p.amount)}</span> <span className="text-[11px] font-medium text-slate-400">so&apos;m</span>
                </td>
                <td className={cn(td, "max-w-[280px]")}>
                  {p.purpose && (
                    <span className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-700 dark:bg-white/[0.07] dark:text-slate-200">{p.purpose}</span>
                  )}
                  {p.status === "PAID" && <div className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{label(PAYMENT_METHOD_LABELS, p.method, locale)}</div>}
                  {p.promoCode && (
                    <div className="mt-1 text-[12px] font-medium text-violet-600 dark:text-violet-300">
                      {L("Promokod", "Промокод", "Promo", "Promo")} {p.promoCode}{p.discount ? ` · −${num(p.discount)}` : ""}
                    </div>
                  )}
                  {p.note && <Note text={p.note} locale={locale} />}
                  {!p.purpose && !p.note && p.status !== "PAID" && <span className="text-[13px] text-slate-300 dark:text-slate-600">—</span>}
                </td>
                <td className={td}>
                  <div className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{p.author ?? L("Tizim", "Система", "System", "System")}</div>
                  <div className="mt-0.5 text-[12px] tabular-nums text-slate-400">{stamp(p.createdAt)}</div>
                </td>
                <td className={cn(td, "pr-4 text-right")}>
                  <div className="flex items-center justify-end gap-1">
                    {p.status === "PAID" && (
                      <button
                        type="button"
                        onClick={() => print(p.id)}
                        disabled={busy === p.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand-300 px-3 text-[12.5px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400/40 dark:text-brand-200 dark:hover:bg-brand-500/10"
                      >
                        <Icon name={busy === p.id ? "refresh" : "printer"} className={cn("h-3.5 w-3.5", busy === p.id && "animate-spin")} />
                        {L("Chop etish", "Печать", "Print", "Drucken")}
                      </button>
                    )}
                    {canEdit && <EditPaymentButton paymentId={p.id} locale={locale} />}
                  </div>
                  {failed === p.id && <div className="mt-1 text-[11px] text-rose-500">{L("Chek ochilmadi", "Чек не открылся", "Receipt unavailable", "Beleg nicht verfügbar")}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {receipt && <ReceiptModal receipt={receipt} locale={locale} onClose={() => setReceipt(null)} />}
    </div>
  );
}
