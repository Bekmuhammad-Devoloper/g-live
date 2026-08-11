"use client";

import { useMemo, useState } from "react";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface VCancel {
  id: string;
  studentName: string;
  amount: number;
  totalCancelled: number;
  teacher: string | null;
  group: string | null;
  reason: string | null;
  cancelledAt: string | null; // ISO
}

export default function CancelledView({ rows, locale }: { rows: VCancel[]; locale: Locale }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.cancelledAt) return !from && !to;
      const d = r.cancelledAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [rows, from, to]);

  const doExport = () => {
    exportRows(
      "bekor_qilingan_tolovlar",
      [
        { key: "n", label: "№" },
        { key: "studentName", label: tr(locale, { uz: "Ism", ru: "Имя", en: "Name" }) },
        { key: "amount", label: tr(locale, { uz: "Bekor qilingan summa", ru: "Отменённая сумма", en: "Cancelled amount" }) },
        { key: "totalCancelled", label: tr(locale, { uz: "Jami bekor qilingan", ru: "Всего отменено", en: "Total cancelled" }) },
        { key: "teacher", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }) },
        { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" }) },
        { key: "reason", label: tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" }) },
        { key: "cancelledAt", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
      ],
      filtered.map((r, i) => ({
        n: i + 1,
        studentName: r.studentName,
        amount: r.amount,
        totalCancelled: r.totalCancelled,
        teacher: r.teacher ?? "",
        group: r.group ?? "",
        reason: r.reason ?? "",
        cancelledAt: r.cancelledAt ? r.cancelledAt.slice(0, 10) : "",
      })),
    );
  };

  return (
    <div className="space-y-3">
      {/* Sana oralig'i filtri */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          {from || to ? (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
              <span className="text-slate-300">–</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
              <button onClick={() => { setFrom(""); setTo(""); }} className="text-slate-400 hover:text-slate-600" title={tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}>✕</button>
            </>
          ) : (
            <button onClick={() => setFrom(new Date().toISOString().slice(0, 10))} className="text-sm text-slate-500 dark:text-slate-400">
              {tr(locale, { uz: "Oraliqni tanlang", ru: "Выберите диапазон", en: "Select range" })}
            </button>
          )}
        </div>
        <button onClick={doExport} disabled={filtered.length === 0} className="ml-auto flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <Icon name="download" className="h-4 w-4" />
          {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
        </button>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
            {tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total count" })}: <span className="font-bold text-slate-800 dark:text-slate-100">{filtered.length}</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 w-12">№</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Ism", ru: "Имя", en: "Name" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Bekor qilingan summa", ru: "Отменённая сумма", en: "Cancelled amount" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Jami bekor qilingan", ru: "Всего отменено", en: "Total cancelled" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Icon name="fileX" className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                    <div className="mt-3 text-base font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</div>
                    <div className="mt-1 text-sm text-slate-400">{tr(locale, { uz: "Yozuvlar yo'q. Filtr yoki qidiruvni o'zgartirib ko'ring.", ru: "Записей нет. Попробуйте изменить фильтр или поиск.", en: "No records. Try changing the filter or search." })}</div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.studentName}</td>
                    <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{formatMoney(r.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatMoney(r.totalCancelled, locale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.teacher ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.group ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
