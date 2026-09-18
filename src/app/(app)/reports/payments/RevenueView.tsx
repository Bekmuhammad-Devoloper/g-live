"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { EDU_STATUS_LABELS, EDU_STATUSES, PAYMENT_METHOD_LABELS, label, formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface RevenueData {
  date: string; // YYYY-MM-DD
  status: string; // "" — hammasi
  students: number;
  expected: number; expectedCount: number;
  carried: number; carriedCount: number;
  paidLast: number; paidLastCount: number;
  paidThis: number; paidThisCount: number;
  remaining: number; remainingCount: number;
  expenses: number; expenseCount: number;
  byMethod: { method: string; amount: number }[];
  noPrices: boolean;
}

const MONTHS: Record<string, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};

export default function RevenueView({ data, locale }: { data: RevenueData; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const d = new Date(`${data.date}T12:00:00`);
  const monthName = `${(MONTHS[locale] ?? MONTHS.uz)[d.getMonth()]} ${d.getFullYear()}`;
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const prevName = `${(MONTHS[locale] ?? MONTHS.uz)[prev.getMonth()]} ${prev.getFullYear()}`;
  const net = data.paidThis - data.expenses;

  const go = (date: string, status: string) => {
    const q = new URLSearchParams();
    q.set("date", date);
    q.set("status", status); // bo'sh = barcha holatlar
    start(() => router.replace(`?${q.toString()}`));
  };

  const money = (n: number) => (n > 0 ? formatMoney(n, locale) : "0");

  const rows = [
    { label: tr(locale, { uz: `Kutilayotgan oylik to'lov (${monthName})`, ru: `Ожидаемая оплата за месяц (${monthName})`, en: `Expected monthly payment (${monthName})`, de: `Erwartete Monatszahlung (${monthName})` }), count: data.expectedCount, amount: data.expected },
    { label: tr(locale, { uz: `Eski oydan qarzdor bo'lib o'tgan o'quvchilar summasi (${prevName})`, ru: `Сумма долга учеников, перешедшего с прошлого месяца (${prevName})`, en: `Student debt carried over from last month (${prevName})`, de: `Schuldenbetrag der Schüler aus dem Vormonat (${prevName})` }), count: data.carriedCount, amount: data.carried },
    { label: tr(locale, { uz: `Eski oyda o'quvchilar to'lagan summa (${prevName})`, ru: `Сумма, оплаченная учениками в прошлом месяце (${prevName})`, en: `Amount paid by students last month (${prevName})`, de: `Von Schülern im Vormonat gezahlter Betrag (${prevName})` }), count: data.paidLastCount, amount: data.paidLast },
    { label: tr(locale, { uz: `Shu oyda to'lagan summa (${monthName})`, ru: `Сумма, оплаченная в этом месяце (${monthName})`, en: `Amount paid this month (${monthName})`, de: `In diesem Monat gezahlter Betrag (${monthName})` }), count: data.paidThisCount, amount: data.paidThis },
    { label: tr(locale, { uz: "Qolgan kutilayotgan tushum (hozirgi qarzdorlik)", ru: "Оставшийся ожидаемый доход (текущая задолженность)", en: "Remaining expected revenue (current debt)", de: "Verbleibender erwarteter Umsatz (aktuelle Schulden)" }), count: data.remainingCount, amount: data.remaining },
  ];

  const doExport = () => {
    exportRows(
      `tushum_${data.date}`,
      [
        { key: "label", label: tr(locale, { uz: "Tushum rejasi", ru: "План поступлений", en: "Revenue plan", de: "Umsatzplan" }) },
        { key: "count", label: tr(locale, { uz: "O'quvchi soni", ru: "Число учеников", en: "Student count", de: "Anzahl der Schüler" }) },
        { key: "amount", label: tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }) },
      ],
      [
        ...rows.map((r) => ({ label: r.label, count: r.count, amount: r.amount })),
        { label: tr(locale, { uz: `Kirim (${monthName})`, ru: `Приход (${monthName})`, en: `Income (${monthName})`, de: `Einnahmen (${monthName})` }), count: data.paidThisCount, amount: data.paidThis },
        { label: tr(locale, { uz: `Chiqim (${monthName})`, ru: `Расход (${monthName})`, en: `Expenses (${monthName})`, de: `Ausgaben (${monthName})` }), count: data.expenseCount, amount: data.expenses },
        { label: tr(locale, { uz: "Sof natija", ru: "Чистый результат", en: "Net result", de: "Nettoergebnis" }), count: "", amount: net },
      ],
    );
  };

  const tile = "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className={cn("space-y-3", pending && "opacity-60 transition")}>
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          <input type="date" value={data.date} onChange={(e) => e.target.value && go(e.target.value, data.status)} className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        </div>

        <div className="relative">
          <select
            value={data.status}
            onChange={(e) => go(data.date, e.target.value)}
            className={cn(
              "h-10 appearance-none rounded-lg border bg-white pl-3 pr-14 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
              data.status ? "border-brand-300 text-brand-700 dark:border-brand-500/40 dark:text-brand-300" : "border-slate-200 text-slate-500 dark:border-slate-700"
            )}
          >
            <option value="">{tr(locale, { uz: "Barcha holatlar", ru: "Все статусы", en: "All statuses", de: "Alle Status" })}</option>
            {EDU_STATUSES.map((st) => (
              <option key={st} value={st}>{label(EDU_STATUS_LABELS, st, locale)}</option>
            ))}
          </select>
          {data.status && (
            <button
              onClick={() => go(data.date, "")}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-700"
              title={tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Löschen" })}
            >
              ✕
            </button>
          )}
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <span className="text-sm text-slate-500 dark:text-slate-400">
          {tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students", de: "Schüler" })}: <b className="text-slate-800 dark:text-slate-100">{data.students}</b>
        </span>

        <button onClick={doExport} className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Icon name="download" className="h-4 w-4" />
          {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      {/* Kirim · Chiqim · Sof natija */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={tile}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Kirim", ru: "Приход", en: "Income", de: "Einnahmen" })} · {monthName}</div>
          <div className="mt-1.5 text-[22px] font-bold text-emerald-600 dark:text-emerald-400">{money(data.paidThis)}</div>
          <div className="mt-0.5 text-[12px] text-slate-500">{data.paidThisCount} {tr(locale, { uz: "o'quvchi to'lagan", ru: "учеников оплатили", en: "students paid", de: "Schüler bezahlt" })}</div>
          {data.byMethod.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.byMethod.map((x) => (
                <span key={x.method} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {label(PAYMENT_METHOD_LABELS, x.method, locale)}: {formatMoney(x.amount, locale)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={tile}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Chiqim", ru: "Расход", en: "Expenses", de: "Ausgaben" })} · {monthName}</div>
          <div className="mt-1.5 text-[22px] font-bold text-rose-600 dark:text-rose-400">{money(data.expenses)}</div>
          <div className="mt-0.5 text-[12px] text-slate-500">{data.expenseCount} {tr(locale, { uz: "ta xarajat yozuvi", ru: "записей расходов", en: "expense records", de: "Ausgabenposten" })}</div>
        </div>
        <div className={tile}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Sof natija", ru: "Чистый результат", en: "Net result", de: "Nettoergebnis" })}</div>
          <div className={cn("mt-1.5 text-[22px] font-bold", net >= 0 ? "text-slate-800 dark:text-slate-100" : "text-rose-600 dark:text-rose-400")}>
            {net < 0 ? "−" : ""}{formatMoney(Math.abs(net), locale)}
          </div>
          <div className="mt-0.5 text-[12px] text-slate-500">{tr(locale, { uz: "kirim − chiqim", ru: "приход − расход", en: "income − expenses", de: "Einnahmen − Ausgaben" })}</div>
        </div>
      </div>

      {data.noPrices && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {tr(locale, {
            uz: "Kutilayotgan to'lov 0 — guruh yoki kurs narxi kiritilmagan. Guruh sahifasida \"Oylik to'lov\"ni yoki Sozlamalar › Moliya'da umumiy narxni kiriting.",
            ru: "Ожидаемая оплата 0 — не указана цена группы или курса. Укажите «Месячную оплату» в группе или общую цену в Настройки › Финансы.",
            en: "Expected payment is 0 — no group or course price set. Enter the monthly fee on the group page or the default price in Settings › Finance.",
            de: "Erwartete Zahlung 0 — kein Gruppen- oder Kurspreis hinterlegt. Monatsgebühr in der Gruppe oder Standardpreis unter Einstellungen › Finanzen eintragen.",
          })}
        </div>
      )}

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">{tr(locale, { uz: "Tushum rejasi", ru: "План поступлений", en: "Revenue plan", de: "Umsatzplan" })}</th>
                <th className="px-5 py-4">{tr(locale, { uz: "O'quvchi soni", ru: "Число учеников", en: "Student count", de: "Anzahl der Schüler" })}</th>
                <th className="px-5 py-4">{tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r, i) => (
                <tr key={i} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", i === rows.length - 1 && "bg-slate-50/60 font-semibold dark:bg-slate-800/30")}>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{r.count}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="px-1 text-[12px] text-slate-400 dark:text-slate-500">
        {tr(locale, {
          uz: "Kutilayotgan to'lov guruh narxi (bo'lmasa kurs narxi, bo'lmasa umumiy narx) bo'yicha; qarzdorlik o'quvchi profilidagi hisob bilan bir xil. Kirim — tasdiqlangan to'lovlar, chiqim — Moliya › Xarajatlar.",
          ru: "Ожидаемая оплата — по цене группы (иначе курса, иначе общей); задолженность совпадает с расчётом в профиле ученика. Приход — подтверждённые платежи, расход — Финансы › Расходы.",
          en: "Expected payment uses the group price (else course, else default); debt matches the student profile. Income = confirmed payments, expenses = Finance › Expenses.",
          de: "Erwartete Zahlung nach Gruppenpreis (sonst Kurs, sonst Standard); Schulden entsprechen dem Schülerprofil. Einnahmen = bestätigte Zahlungen, Ausgaben = Finanzen › Ausgaben.",
        })}
      </p>
    </div>
  );
}
