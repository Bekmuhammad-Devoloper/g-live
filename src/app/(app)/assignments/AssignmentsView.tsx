"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import NewAssignmentForm, { typeLabels } from "./NewAssignmentForm";

export interface VAssignment {
  id: string;
  type: string;
  title: string;
  dueAt: string; // formatlangan yoki ""
  teacherName: string | null;
  groupId: string;
  groupName: string;
  maxScore: number;
  note: string | null;
  createdAt: string; // formatlangan
  submissions: number;
}

const typeTone: Record<string, string> = {
  EXAM: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  TASK: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  HOMEWORK: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  TEST: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

type SortKey = "title" | "maxScore" | "createdAt";

export default function AssignmentsView({
  locale,
  assignments,
  canCreate,
  groups,
  teacherNames,
  groupNames,
}: {
  locale: Locale;
  assignments: VAssignment[];
  canCreate: boolean;
  groups: { id: string; name: string }[];
  teacherNames: string[];
  groupNames: string[];
}) {
  const TYPE_LABELS = typeLabels(locale);
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const hasFilters = !!(type || group || teacher || search);
  function resetFilters() { setType(""); setGroup(""); setTeacher(""); setSearch(""); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = assignments.filter((a) => {
      if (type && a.type !== type) return false;
      if (group && a.groupName !== group) return false;
      if (teacher && a.teacherName !== teacher) return false;
      if (q && !`${a.title} ${a.groupName} ${a.teacherName ?? ""} ${a.note ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sort.key === "maxScore") return (a.maxScore - b.maxScore) * dir;
      if (sort.key === "createdAt") return a.createdAt.localeCompare(b.createdAt) * dir;
      return a.title.localeCompare(b.title) * dir;
    });
    return list;
  }, [assignments, type, group, teacher, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <button onClick={() => setAddOpen(true)} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Imtihon qo'shish", ru: "Добавить экзамен", en: "Add exam" })}
          </button>
        )}
        <FilterSelect value={type} onChange={setType} placeholder={tr(locale, { uz: "Turi", ru: "Тип", en: "Type" })} options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ v, label: l }))} />
        <FilterSelect value={group} onChange={setGroup} placeholder={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })} options={groupNames.map((n) => ({ v: n, label: n }))} />
        <FilterSelect value={teacher} onChange={setTeacher} placeholder={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} options={teacherNames.map((n) => ({ v: n, label: n }))} />
        <button onClick={resetFilters} title={tr(locale, { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters" })} className={cn("flex h-10 w-10 items-center justify-center rounded-lg border transition", hasFilters ? "border-brand-300 text-brand-600 hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300" : "border-slate-200 text-slate-400 dark:border-slate-700")}>
          <Icon name="filter" className="h-4 w-4" />
        </button>
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Turi", ru: "Тип", en: "Type" })}</th>
                <SortableTh label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name" })} active={sort.key === "title"} dir={sort.dir} onClick={() => toggleSort("title")} />
                <th className="px-4 py-3">{tr(locale, { uz: "Topshirish muddati", ru: "Срок сдачи", en: "Due date" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</th>
                <SortableTh label={tr(locale, { uz: "Maksimal ball", ru: "Максимальный балл", en: "Max score" })} active={sort.key === "maxScore"} dir={sort.dir} onClick={() => toggleSort("maxScore")} />
                <th className="px-4 py-3">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })}</th>
                <SortableTh label={tr(locale, { uz: "Yaratilgan sanasi", ru: "Дата создания", en: "Created date" })} active={sort.key === "createdAt"} dir={sort.dir} onClick={() => toggleSort("createdAt")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="text-3xl opacity-30">📭</div>
                    <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                  </td>
                </tr>
              ) : (
                shown.map((a, i) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{(curPage - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", typeTone[a.type] ?? typeTone.TASK)}>{TYPE_LABELS[a.type] ?? a.type}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.title}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{a.dueAt || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.teacherName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/groups/${a.groupId}`} className="text-brand-700 hover:underline dark:text-brand-300">{a.groupName}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.maxScore}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={a.note ?? ""}>{a.note || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{a.createdAt}</td>
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

      {canCreate && (
        <button onClick={() => setAddOpen(true)} title={tr(locale, { uz: "Imtihon qo'shish", ru: "Добавить экзамен", en: "Add exam" })} className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700">
          <Icon name="plus" className="h-5 w-5" />
        </button>
      )}

      <NewAssignmentForm locale={locale} groups={groups} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="px-4 py-3">
      <button onClick={onClick} className={cn("flex items-center gap-1 uppercase tracking-wider transition", active ? "text-brand-600 dark:text-brand-300" : "hover:text-slate-700 dark:hover:text-slate-200")}>
        {label}
        <span className={cn("text-[10px]", active ? "opacity-100" : "opacity-30")}>{active && dir === "desc" ? "↓" : "↑"}</span>
      </button>
    </th>
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
