"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows, printPage } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface VCancelled {
  id: string; student: string; group: string | null; course: string | null; cancelledBy: string | null; dateIso: string; dateLabel: string;
}

export default function CancelledView({ rows, defaultFrom, defaultTo, locale }: { rows: VCancelled[]; defaultFrom: string; defaultTo: string; locale: Locale }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (from && r.dateIso < from) return false;
      if (to && r.dateIso > to) return false;
      if (q && !`${r.student} ${r.group ?? ""} ${r.course ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, from, to, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Davomati bekor qilinganlar analitikasi", ru: "Аналитика отменённой посещаемости", en: "Cancelled attendance analytics" })}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search" })} className="h-11 w-48 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
            <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
            <span className="text-slate-300">–</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[118px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          </div>
          <button
            onClick={() => exportRows("davomat-bekor-qilinganlar", [
              { key: "student", label: tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" }) },
              { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" }) },
              { key: "course", label: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" }) },
              { key: "cancelledBy", label: tr(locale, { uz: "Kim bekor qildi", ru: "Кто отменил", en: "Cancelled by" }) },
              { key: "dateLabel", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
            ], filtered.map((r) => ({ student: r.student, group: r.group ?? "—", course: r.course ?? "—", cancelledBy: r.cancelledBy ?? "—", dateLabel: r.dateLabel })))}
            title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-300 px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => printPage()}
            title={tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print" })}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total count" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</th><th className="px-4 py-3 text-center">{tr(locale, { uz: "Miqdori", ru: "Кол-во", en: "Count" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Kim bekor qildi?", ru: "Кто отменил?", en: "Cancelled by?" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                </td></tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.student}</td>
                  <td className="px-4 py-3 text-center"><span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">1</span></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.group ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.course ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.cancelledBy ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.dateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} {tr(locale, { uz: "qator", ru: "строк", en: "rows" })}</option>)}
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
