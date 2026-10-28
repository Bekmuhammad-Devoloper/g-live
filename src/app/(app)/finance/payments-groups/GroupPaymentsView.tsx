"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportXlsx } from "@/lib/export";
import { Icon } from "../../_components/Icon";
import PeriodTotal from "../_components/PeriodTotal";
import Pagination, { PAGE_SIZE, fmtDate } from "../_components/Pagination";

export interface VGroupRow {
  groupId: string | null;
  name: string | null;
  startDate: string | null;
  teacher: string | null;
  courseId: string | null;
  course: string | null;
  amount: number;
  payers: number;
}

type SortKey = "name" | "teacher" | "course" | "amount" | "payers";

export default function GroupPaymentsView({ rows, total, from, to, locale }: { rows: VGroupRow[]; total: number; from: string; to: string; locale: Locale }) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const noGroup = tr(locale, { uz: "Guruhsiz", ru: "Без группы", en: "No group", de: "Ohne Gruppe" });
  const L = {
    name: tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" }),
    teacher: tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" }),
    course: tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" }),
    amount: tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }),
    payers: tr(locale, { uz: "To'lovchilar", ru: "Плательщики", en: "Payers", de: "Zahler" }),
  };

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let r: number;
      if (sortKey === "amount" || sortKey === "payers") r = a[sortKey] - b[sortKey];
      else r = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
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
      `guruhlar-tolovlari_${from}_${to}`,
      [
        { key: "name", label: L.name },
        { key: "start", label: tr(locale, { uz: "Boshlanish sanasi", ru: "Дата начала", en: "Start date", de: "Startdatum" }) },
        { key: "teacher", label: L.teacher },
        { key: "course", label: L.course },
        { key: "amount", label: L.amount },
        { key: "payers", label: L.payers },
      ],
      sorted.map((r) => ({
        name: r.name ?? noGroup,
        start: r.startDate ? fmtDate(r.startDate) : "",
        teacher: r.teacher ?? "",
        course: r.course ?? "",
        amount: r.amount,
        payers: r.payers,
      })),
      L.name,
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Guruhlar bo'yicha to'lovlar", ru: "Платежи по группам", en: "Payments by groups", de: "Zahlungen nach Gruppen" })}</h1>

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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                {(["name", "teacher", "course", "amount", "payers"] as SortKey[]).map((k) => (
                  <th key={k} className="cursor-pointer select-none px-4 py-3.5" onClick={() => toggleSort(k)}>
                    <span className="inline-flex items-center gap-1">{L[k]}<span className="text-brand-500">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.groupId ?? "none"} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      {r.groupId ? (
                        <Link href={`/groups/${r.groupId}`} className="font-medium text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{r.name}</Link>
                      ) : (
                        <span className="font-medium italic text-slate-500">{noGroup}</span>
                      )}
                      {r.startDate && <span className="text-slate-400"> • {fmtDate(r.startDate)}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.teacher ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.courseId ? <Link href={`/courses/${r.courseId}`} className="hover:text-brand-600 hover:underline">{r.course}</Link> : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(r.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.payers}</td>
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
