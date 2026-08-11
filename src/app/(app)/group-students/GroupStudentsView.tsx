"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

export interface VGroupStudent {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  eduStatus: string;
  groups: { id: string; name: string; status: string }[];
  teachers: string[];
  joinedAt: string; // YYYY-MM-DD yoki ""
}

const STATUS_CLS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  WAITING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  FROZEN: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  TRANSFERRED: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  EXPELLED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  CERTIFIED: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
};
const statusLabel = (locale: Locale, key: string): string | null => {
  const m: Record<string, { uz: string; ru: string; en: string }> = {
    ACTIVE: { uz: "Faol", ru: "Активен", en: "Active" },
    WAITING: { uz: "Kutmoqda", ru: "Ожидает", en: "Waiting" },
    FROZEN: { uz: "Muzlatilgan", ru: "Заморожен", en: "Frozen" },
    TRANSFERRED: { uz: "Ko'chirilgan", ru: "Переведён", en: "Transferred" },
    EXPELLED: { uz: "Chetlashtirilgan", ru: "Отчислен", en: "Expelled" },
    CERTIFIED: { uz: "Bitirgan", ru: "Выпускник", en: "Graduated" },
  };
  return m[key] ? tr(locale, m[key]) : null;
};
const groupStatusOpts = (locale: Locale) => [
  { v: "ACTIVE", label: tr(locale, { uz: "Aktiv", ru: "Активная", en: "Active" }) },
  { v: "PLANNED", label: tr(locale, { uz: "Rejalashtirilgan", ru: "Запланирована", en: "Planned" }) },
  { v: "FINISHED", label: tr(locale, { uz: "Tugagan", ru: "Завершена", en: "Finished" }) },
  { v: "CANCELLED", label: tr(locale, { uz: "Bekor qilingan", ru: "Отменена", en: "Cancelled" }) },
];

export default function GroupStudentsView({ locale, students, teacherNames }: { locale: Locale; students: VGroupStudent[]; teacherNames: string[] }) {
  const [frozen, setFrozen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (frozen && st.eduStatus !== "FROZEN") return false;
      if (teacher && !st.teachers.includes(teacher)) return false;
      if (groupStatus && !st.groups.some((g) => g.status === groupStatus)) return false;
      if (from && (!st.joinedAt || st.joinedAt < from)) return false;
      if (to && (!st.joinedAt || st.joinedAt > to)) return false;
      if (q && !`${st.fullName} ${st.phone ?? ""} ${st.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, frozen, teacher, groupStatus, from, to, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFrozen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <span className={cn("relative h-5 w-9 rounded-full transition", frozen ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", frozen ? "left-4" : "left-0.5")} />
          </span>
          {tr(locale, { uz: "Muzlatilgan", ru: "Замороженные", en: "Frozen" })}
        </button>

        <FilterSelect value={teacher} onChange={setTeacher} placeholder={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} options={teacherNames.map((n) => ({ v: n, label: n }))} />
        <FilterSelect value={groupStatus} onChange={setGroupStatus} placeholder={tr(locale, { uz: "Guruh holati", ru: "Статус группы", en: "Group status" })} options={groupStatusOpts(locale)} />

        <div className={cn("flex h-10 items-center gap-1 rounded-lg border bg-white px-2.5 dark:bg-slate-800", from || to ? "border-brand-300 dark:border-brand-500/40" : "border-slate-200 dark:border-slate-700")}>
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="text-slate-400 hover:text-slate-600">✕</button>}
        </div>

        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidirish", ru: "Поиск", en: "Search" })} className="h-10 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni:", ru: "Всего:", en: "Total:" })} {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Ism", ru: "Имя", en: "Name" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="text-3xl opacity-30">📭</div>
                    <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                  </td>
                </tr>
              ) : (
                shown.map((st, i) => (
                  <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{(curPage - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{st.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{st.fullName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {st.groups.length === 0 ? <span className="text-xs text-slate-400">—</span> : st.groups.map((g) => (
                          <Link key={g.id} href={`/groups/${g.id}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700/50 dark:text-slate-300">{g.name}</Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{st.teachers.length ? st.teachers.join(", ") : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", STATUS_CLS[st.eduStatus] ?? "bg-slate-400/20 text-slate-500")}>{statusLabel(locale, st.eduStatus) ?? st.eduStatus}</span>
                    </td>
                  </tr>
                ))
              )}
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
              <PageBtn disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{curPage} / {totalPages}</span>
              <PageBtn disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("h-10 appearance-none rounded-lg border bg-white pl-3 pr-8 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100", value ? "border-brand-300 text-slate-800 dark:border-brand-500/40" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">
      {children}
    </button>
  );
}
