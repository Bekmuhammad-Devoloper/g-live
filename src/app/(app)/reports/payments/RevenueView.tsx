"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { EDU_STATUS_LABELS, EDU_STATUSES, label, formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface RPayment {
  amount: number;
  studentId: string | null;
  createdAt: string; // ISO
}

interface Props {
  payments: RPayment[];
  students: { id: string; eduStatus: string }[];
  locale: Locale;
  defaultDate: string; // YYYY-MM-DD
}

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function RevenueView({ payments, students, locale, defaultDate }: Props) {
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState("ACTIVE");

  const rows = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    const y = d.getFullYear(), m = d.getMonth();
    const prevY = m === 0 ? y - 1 : y, prevM = m === 0 ? 11 : m - 1;
    const inMonth = (iso: string, yy: number, mm: number) => {
      const x = new Date(iso);
      return x.getFullYear() === yy && x.getMonth() === mm;
    };

    const eligible = status ? students.filter((s) => s.eduStatus === status) : students;
    const eligibleIds = new Set(eligible.map((s) => s.id));
    const rel = payments.filter((p) => !status || (p.studentId && eligibleIds.has(p.studentId)));

    const thisM = rel.filter((p) => inMonth(p.createdAt, y, m));
    const lastM = rel.filter((p) => inMonth(p.createdAt, prevY, prevM));
    const sum = (arr: RPayment[]) => arr.reduce((n, p) => n + p.amount, 0);
    const uniq = (arr: RPayment[]) => new Set(arr.map((p) => p.studentId).filter(Boolean)).size;

    return [
      { label: fmtDate(date), count: eligible.length, amount: 0 },
      { label: tr(locale, { uz: "Eski oydan qarzdor bo'lib o'tgan o'quvchilar summasi", ru: "Сумма долга учеников, перешедшего с прошлого месяца", en: "Amount of student debt carried over from last month", de: "Schuldenbetrag der Schüler aus dem Vormonat" }), count: 0, amount: 0 },
      { label: tr(locale, { uz: "Eski oydan o'quvchilar to'lab o'tgan summa", ru: "Сумма, оплаченная учениками с прошлого месяца", en: "Amount paid by students from last month", de: "Von Schülern aus dem Vormonat gezahlter Betrag" }), count: uniq(lastM), amount: sum(lastM) },
      { label: tr(locale, { uz: "Shu oyda to'lagan summa", ru: "Сумма, оплаченная в этом месяце", en: "Amount paid this month", de: "In diesem Monat gezahlter Betrag" }), count: uniq(thisM), amount: sum(thisM) },
      { label: tr(locale, { uz: "Qolgan kutilayotgan tushum", ru: "Оставшийся ожидаемый доход", en: "Remaining expected revenue", de: "Verbleibender erwarteter Umsatz" }), count: null as number | null, amount: 0 },
    ];
  }, [payments, students, date, status, locale]);

  const doExport = () => {
    exportRows(
      `tushum_${date}`,
      [
        { key: "label", label: tr(locale, { uz: "Tushum rejasi", ru: "План поступлений", en: "Revenue plan", de: "Umsatzplan" }) },
        { key: "count", label: tr(locale, { uz: "O'quvchi soni", ru: "Число учеников", en: "Student count", de: "Anzahl der Schüler" }) },
        { key: "amount", label: tr(locale, { uz: "Umumiy kutilayotgan summa", ru: "Общая ожидаемая сумма", en: "Total expected amount", de: "Gesamter erwarteter Betrag" }) },
      ],
      rows.map((r) => ({ label: r.label, count: r.count === null ? "" : r.count, amount: r.amount })),
    );
  };

  return (
    <div className="space-y-3">
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        </div>

        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(
              "h-10 appearance-none rounded-lg border bg-white pl-3 pr-14 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
              status ? "border-brand-300 text-brand-700 dark:border-brand-500/40 dark:text-brand-300" : "border-slate-200 text-slate-500 dark:border-slate-700"
            )}
          >
            <option value="">{tr(locale, { uz: "Barcha holatlar", ru: "Все статусы", en: "All statuses", de: "Alle Status" })}</option>
            {EDU_STATUSES.map((st) => (
              <option key={st} value={st}>{label(EDU_STATUS_LABELS, st, locale)}</option>
            ))}
          </select>
          {status && (
            <button
              onClick={() => setStatus("")}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-700"
              title={tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Löschen" })}
            >
              ✕
            </button>
          )}
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <button onClick={doExport} className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Icon name="download" className="h-4 w-4" />
          {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">{tr(locale, { uz: "Tushum rejasi", ru: "План поступлений", en: "Revenue plan", de: "Umsatzplan" })}</th>
                <th className="px-5 py-4">{tr(locale, { uz: "O'quvchi soni", ru: "Число учеников", en: "Student count", de: "Anzahl der Schüler" })}</th>
                <th className="px-5 py-4">{tr(locale, { uz: "Umumiy kutilayotgan summa", ru: "Общая ожидаемая сумма", en: "Total expected amount", de: "Gesamter erwarteter Betrag" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r, i) => (
                <tr key={i} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{r.count === null ? "" : r.count}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                    {r.amount > 0 ? formatMoney(r.amount, locale) : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
