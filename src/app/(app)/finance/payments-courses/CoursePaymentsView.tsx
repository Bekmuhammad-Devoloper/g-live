"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportXlsx } from "@/lib/export";
import { Icon } from "../../_components/Icon";
import PeriodTotal from "../_components/PeriodTotal";
import Pagination, { PAGE_SIZE } from "../_components/Pagination";

export interface VCourseRow {
  courseId: string | null;
  name: string | null;
  amount: number;
}

type SortKey = "name" | "amount";

export default function CoursePaymentsView({ rows, total, from, to, locale }: { rows: VCourseRow[]; total: number; from: string; to: string; locale: Locale }) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const noCourse = tr(locale, { uz: "Guruhsiz", ru: "Без группы", en: "No group", de: "Ohne Gruppe" });
  const L = {
    name: tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" }),
    amount: tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }),
  };

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const r = sortKey === "amount" ? a.amount - b.amount : String(a.name ?? "").localeCompare(String(b.name ?? ""));
      return sortDir === "asc" ? r : -r;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const doExport = () => {
    void exportXlsx(
      `kurslar-tolovlari_${from}_${to}`,
      [{ key: "name", label: L.name }, { key: "amount", label: L.amount }],
      sorted.map((r) => ({ name: r.name ?? noCourse, amount: r.amount })),
      L.name,
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Kurslar bo'yicha to'lovlar", ru: "Платежи по курсам", en: "Payments by courses", de: "Zahlungen nach Kursen" })}</h1>

      <PeriodTotal total={total} from={from} to={to} locale={locale} />

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: <b className="text-slate-800 dark:text-slate-100">{rows.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items", de: "St." })}</span>
          <button type="button" onClick={doExport} disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/30">
            <Icon name="download" className="h-4 w-4" /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                {(["name", "amount"] as SortKey[]).map((k) => (
                  <th key={k} className="cursor-pointer select-none px-4 py-3.5" onClick={() => toggleSort(k)}>
                    <span className="inline-flex items-center gap-1">{L[k]}<span className="text-brand-500">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.courseId ?? "none"} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      {r.courseId ? (
                        <Link href={`/courses/${r.courseId}`} className="font-medium text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{r.name}</Link>
                      ) : (
                        <span className="font-medium italic text-slate-500">{noCourse}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(r.amount, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={sorted.length} onChange={setPage} locale={locale} />
      </div>
    </div>
  );
}
