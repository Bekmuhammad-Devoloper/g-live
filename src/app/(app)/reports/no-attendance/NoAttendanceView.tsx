"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows, printPage } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface VNoAtt { id: string; groupId: string; name: string; dateIso: string; dateLabel: string; teacher: string | null }

export default function NoAttendanceView({ rows, defaultFrom, defaultTo, canMark = false, locale }: { rows: VNoAtt[]; defaultFrom: string; defaultTo: string; canMark?: boolean; locale: Locale }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => rows.filter((r) => {
    if (from && r.dateIso < from) return false;
    if (to && r.dateIso > to) return false;
    return true;
  }), [rows, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
          <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); }} className="ml-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}: {filtered.length} {tr(locale, { uz: "ta dars", ru: "уроков", en: "lessons", de: "Unterrichtsstunden" })}</div>
          <button
            onClick={() => exportRows("davomat-qilinmagan", [
              { key: "name", label: tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }) },
              { key: "dateLabel", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }) },
              { key: "teacher", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" }) },
            ], filtered.map((r) => ({ name: r.name, dateLabel: r.dateLabel, teacher: r.teacher ?? "—" })))}
            title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-300 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => printPage()}
            title={tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total count", de: "Gesamtzahl" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th><th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th>{canMark && <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amal", ru: "Действие", en: "Action", de: "Aktion" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={canMark ? 5 : 4} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter.", de: "Keine Daten gefunden. Versuchen Sie, den Filter zu ändern." })}</p>
                </td></tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.dateLabel}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.teacher ?? "—"}</td>
                  {canMark && (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/groups/${r.groupId}/lessons/${r.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700">
                        <Icon name="check" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Davomat qilish", ru: "Отметить посещаемость", en: "Mark attendance", de: "Anwesenheit erfassen" })}
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} {tr(locale, { uz: "qator", ru: "строк", en: "rows", de: "Zeilen" })}</option>)}
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-sm">
              <PageBtn disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{cur} / {totalPages}</span>
              <PageBtn disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800")}>{children}</button>;
}
