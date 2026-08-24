"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "../_components/Icon";
import UserAvatar from "../_components/UserAvatar";
import { StatCard, Badge } from "../_components/ui";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import TeacherCard, { colorFor } from "./TeacherCard";
import NewTeacherForm, { type BranchOption } from "./NewTeacherForm";
import { groupColor } from "../groups/groupColor";

export interface SalaryMonth {
  year: number; month: number; fiksa: number; bonus: number; penalty: number; kpi: number; total: number; closed: boolean;
}
export interface VTeacher {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  branch: string | null;
  active: boolean;
  gender: "MALE" | "FEMALE" | null;
  groups: { id: string; name: string; color: string | null; students: number; lessons: number }[];
  totalStudents: number;
  totalLessons: number;
  fiksa: number;
  kpi: number;
  bonus: number;
  penalty: number;
  monthTotal: number;
  history: SalaryMonth[];
}


export default function TeachersView({ teachers, canManage, locale, branches }: { teachers: VTeacher[]; canManage: boolean; locale: Locale; branches: BranchOption[] }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [addOpen, setAddOpen] = useState(false);

  // Global qidiruvdan kelinganda (/teachers?teacher=<id>) o'sha o'qituvchi
  // qidiruvga qo'yiladi — kartasi darhol ko'rinadi. useSearchParams sahifa
  // qayta yuklanmasa ham (yumshoq o'tish) manzil o'zgarishini eshitadi.
  const openTeacherId = searchParams.get("teacher");
  useEffect(() => {
    if (!openTeacherId) return;
    const found = teachers.find((t) => t.id === openTeacherId);
    if (found) setSearch(found.fullName);
  }, [openTeacherId, teachers]);

  const totals = useMemo(() => ({
    teachers: teachers.length,
    groups: teachers.reduce((n, t) => n + t.groups.length, 0),
    students: teachers.reduce((n, t) => n + t.totalStudents, 0),
    lessons: teachers.reduce((n, t) => n + t.totalLessons, 0),
    fund: teachers.reduce((n, t) => n + t.monthTotal, 0),
    maxStudents: Math.max(1, ...teachers.map((t) => t.totalStudents)),
  }), [teachers]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? teachers.filter((t) => `${t.fullName} ${t.phone ?? ""}`.toLowerCase().includes(q)) : teachers;
  }, [teachers, search]);

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers" })}</h1>
          <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-sm font-bold text-brand-500">{teachers.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidirish...", ru: "Поиск...", en: "Search..." })} className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} icon="grid" />
            <ViewBtn active={view === "table"} onClick={() => setView("table")} icon="listView" />
          </div>
          {canManage && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi o'qituvchi", ru: "Новый преподаватель", en: "New teacher" })}
            </button>
          )}
        </div>
      </div>

      {addOpen && <NewTeacherForm branches={branches} locale={locale} onClose={() => setAddOpen(false)} />}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers" })} value={totals.teachers} tone="brand" icon="teacher" />
        <StatCard label={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })} value={totals.groups} icon="layers" />
        <StatCard label={tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })} value={totals.students} tone="green" icon="graduation" />
        <StatCard label={tr(locale, { uz: "Darslar", ru: "Занятия", en: "Lessons" })} value={totals.lessons} icon="check" />
        <StatCard label={tr(locale, { uz: "Oylik fond", ru: "Месячный фонд", en: "Monthly fund" })} value={formatMoney(totals.fund, locale)} tone="amber" icon="wallet" />
      </div>

      {/* Kontent */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <div className="text-3xl opacity-30">🧑‍🏫</div>
          <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "O'qituvchi topilmadi", ru: "Преподаватели не найдены", en: "No teachers found" })}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((t) => <TeacherCard key={t.id} teacher={t} maxStudents={totals.maxStudents} canManage={canManage} locale={locale} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Darslar", ru: "Занятия", en: "Lessons" })}</th>
                  <th className="px-4 py-3">KPI</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Bu oy maosh", ru: "Зарплата за месяц", en: "This month salary" })}</th>
                  <th className="px-4 py-3">{tr(locale, { uz: "Holat", ru: "Статус", en: "Status" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.map((t) => {
                  const color = colorFor(t.fullName);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={t.fullName} imageUrl={t.imageUrl} role="TEACHER" size="sm" className="!h-8 !w-8 !rounded-full" />
                          <span className="font-medium text-slate-800 dark:text-slate-100">{t.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{t.phone ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{t.branch ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {t.groups.length === 0 ? <span className="text-xs text-slate-400">—</span> : t.groups.map((g) => (
                            <Link key={g.id} href={`/groups/${g.id}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700/50 dark:text-slate-300"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: groupColor(g.id, g.color) }} />{g.name}</Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><Badge tone="green">{t.totalStudents}</Badge></td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{t.totalLessons}</td>
                      <td className="px-4 py-2.5">{t.kpi > 0 ? <span className="font-semibold text-violet-600 dark:text-violet-400">+{formatMoney(t.kpi, locale)}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(t.monthTotal, locale)}</td>
                      <td className="px-4 py-2.5">{t.active ? <Badge tone="green">{tr(locale, { uz: "Faol", ru: "Активен", en: "Active" })}</Badge> : <Badge tone="slate">{tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive" })}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: string }) {
  return (
    <button onClick={onClick} className={cn("flex h-8 w-9 items-center justify-center rounded-md transition", active ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700")}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
