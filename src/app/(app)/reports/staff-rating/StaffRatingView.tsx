"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

export interface VRating {
  id: string; teacher: string; student: string | null; course: string | null; group: string | null;
  lessonDate: string | null; comment: string | null; dateIso: string; dateLabel: string; rating: number;
}
interface Opts { groups: string[]; courses: string[]; teachers: string[]; students: string[] }

export default function StaffRatingView({ rows, opts, locale }: { rows: VRating[]; opts: Opts; locale: Locale }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [izoh, setIzoh] = useState("");
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [student, setStudent] = useState("");
  const [rating, setRating] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (from && r.dateIso < from) return false;
      if (to && r.dateIso > to) return false;
      if (izoh === "bor" && !r.comment) return false;
      if (izoh === "yoq" && r.comment) return false;
      if (group && r.group !== group) return false;
      if (course && r.course !== course) return false;
      if (teacher && r.teacher !== teacher) return false;
      if (student && r.student !== student) return false;
      if (rating && r.rating !== Number(rating)) return false;
      return true;
    });
    if (sortCol) {
      const val = (r: VRating): string | number => {
        if (sortCol === "rating") return r.rating;
        if (sortCol === "date") return r.dateIso;
        return (r as unknown as Record<string, string | null>)[sortCol] ?? "";
      };
      list.sort((a, b) => {
        const va = val(a), vb = val(b);
        const cmp = typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, from, to, izoh, group, course, teacher, student, rating, sortCol, sortDir]);

  const avg = filtered.length ? Math.round((filtered.reduce((n, r) => n + r.rating, 0) / filtered.length) * 10) / 10 : 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  const p1 = () => setPage(1);

  const onExport = () => {
    exportRows(
      "xodimlar-reytingi",
      [
        { key: "teacher", label: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }) },
        { key: "student", label: tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" }) },
        { key: "course", label: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" }) },
        { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" }) },
        { key: "lessonDate", label: tr(locale, { uz: "Dars sanasi", ru: "Дата урока", en: "Lesson date" }) },
        { key: "comment", label: tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" }) },
        { key: "dateLabel", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
        { key: "rating", label: tr(locale, { uz: "Baho", ru: "Оценка", en: "Rating" }) },
      ],
      filtered.map((r) => ({
        teacher: r.teacher, student: r.student ?? "", course: r.course ?? "", group: r.group ?? "",
        lessonDate: r.lessonDate ?? "", comment: r.comment ?? "", dateLabel: r.dateLabel, rating: r.rating,
      })),
    );
  };

  const SortTh = ({ col, label, className }: { col: string; label: string; className?: string }) => (
    <th className={cn("px-4 py-3", className)}>
      <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-300" title={tr(locale, { uz: "Saralash", ru: "Сортировка", en: "Sort" })}>
        <span>{label}</span>
        <Icon name="arrow" className={cn("h-3 w-3", sortCol === col ? "text-brand-500" : "text-slate-300 dark:text-slate-600", sortCol === col && sortDir === "asc" && "rotate-180")} />
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
          <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); p1(); }} className="w-[110px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" placeholder={tr(locale, { uz: "dan", ru: "с", en: "from" })} />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); p1(); }} className="w-[110px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        </div>
        <Sel v={izoh} set={(x) => { setIzoh(x); p1(); }} ph={tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" })} opts={[{ v: "bor", label: tr(locale, { uz: "Izoh bor", ru: "Есть комментарий", en: "Has comment" }) }, { v: "yoq", label: tr(locale, { uz: "Izoh yo'q", ru: "Нет комментария", en: "No comment" }) }]} />
        <Sel v={group} set={(x) => { setGroup(x); p1(); }} ph={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })} opts={opts.groups.map((x) => ({ v: x, label: x }))} />
        <Sel v={course} set={(x) => { setCourse(x); p1(); }} ph={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })} opts={opts.courses.map((x) => ({ v: x, label: x }))} />
        <Sel v={teacher} set={(x) => { setTeacher(x); p1(); }} ph={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} opts={opts.teachers.map((x) => ({ v: x, label: x }))} />
        <Sel v={student} set={(x) => { setStudent(x); p1(); }} ph={tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })} opts={opts.students.map((x) => ({ v: x, label: x }))} />
        <Sel v={rating} set={(x) => { setRating(x); p1(); }} ph={tr(locale, { uz: "Reyting", ru: "Рейтинг", en: "Rating" })} opts={[5, 4, 3, 2, 1].map((n) => ({ v: String(n), label: `${n} ⭐` }))} />
        <button type="button" onClick={onExport} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
          <Icon name="download" className="h-4 w-4" />
          CSV
        </button>
      </div>

      <div className="text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "O'rtacha reyting", ru: "Средний рейтинг", en: "Average rating" })}: <b className="text-amber-600 dark:text-amber-400">{avg}</b></div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total count" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th>
                <SortTh col="teacher" label={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} />
                <SortTh col="student" label={tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })} />
                <SortTh col="course" label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })} />
                <SortTh col="group" label={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })} />
                <SortTh col="lessonDate" label={tr(locale, { uz: "Dars sanasi", ru: "Дата урока", en: "Lesson date" })} />
                <th className="px-4 py-3">{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" })}</th>
                <SortTh col="date" label={tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })} />
                <SortTh col="rating" label={tr(locale, { uz: "Baho", ru: "Оценка", en: "Rating" })} className="text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                </td></tr>
              ) : shown.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{(cur - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.teacher}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.student ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.course ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.group ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.lessonDate ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={r.comment ?? ""}>{r.comment ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{r.dateLabel}</td>
                  <td className="px-4 py-3 text-center"><span className="font-bold text-amber-600 dark:text-amber-400">{"⭐".repeat(r.rating)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); p1(); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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

function Sel({ v, set, ph, opts }: { v: string; set: (x: string) => void; ph: string; opts: { v: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={v} onChange={(e) => set(e.target.value)} className={cn("h-11 appearance-none rounded-xl border bg-white pl-3 pr-8 text-sm outline-none focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100", v ? "border-brand-300 text-slate-800 dark:border-brand-500/40" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
        <option value="">{ph}</option>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">{children}</button>;
}
