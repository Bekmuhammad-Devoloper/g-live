"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import CourseFormDrawer from "./CourseFormDrawer";
import { colorFor, loadMeta, saveMetaFor, type CourseMeta } from "./shared";

export interface VCourse {
  id: string;
  name: string;
  levels: number;
  groups: number;
  banner: string | null; // birinchi banner (muqova)
  monthlyFee: number | null; // oylik narx — BAZADAN keladi (qarz hisobida ishlatiladi)
}

export default function CoursesView({ courses, locale }: { courses: VCourse[]; locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [meta, setMeta] = useState<Record<string, CourseMeta>>({});
  const [addOpen, setAddOpen] = useState(false);

  // Kurs kodi va davomiyligi hali brauzer xotirasida; narx esa bazadan keladi
  useEffect(() => { setMeta(loadMeta()); }, []);

  return (
    <div>
      {/* Sarlavha + qo'shish tugmasi */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-5 dark:border-slate-800">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{T("Kurslar", "Курсы", "Courses", "Kurse")}</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-[#1f3a5f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#152a45]"
        >
          {T("Yangisini qo'shish", "Добавить новый", "Add new", "Neu hinzufügen")}
        </button>
      </div>

      {/* Kartochkalar */}
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-20 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div className="text-4xl opacity-30">📚</div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{T("Hozircha kurs yo'q. \"Yangisini qo'shish\" tugmasi orqali qo'shing.", "Курсов пока нет. Добавьте через кнопку «Добавить новый».", "No courses yet. Add one with the \"Add new\" button.", "Noch keine Kurse. Fügen Sie einen über „Neu hinzufügen“ hinzu.")}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} meta={meta[c.id]} locale={locale} />
          ))}
        </div>
      )}

      <CourseFormDrawer mode="create" locale={locale} open={addOpen} onClose={() => setAddOpen(false)} onSaved={(id, m) => setMeta(saveMetaFor(id, m))} />
    </div>
  );
}

function CourseCard({ course, meta, locale }: { course: VCourse; meta?: CourseMeta; locale: Locale }) {
  const sub = meta?.months
    ? tr(locale, { uz: `${meta.months} oy`, ru: `${meta.months} мес.`, en: `${meta.months} mo.`, de: `${meta.months} Mon.` })
    : tr(locale, { uz: `${course.levels} daraja · ${course.groups} guruh`, ru: `${course.levels} уровней · ${course.groups} групп`, en: `${course.levels} levels · ${course.groups} groups`, de: `${course.levels} Stufen · ${course.groups} Gruppen` });
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className="relative flex h-44 flex-col items-center px-4 pt-6"
        style={course.banner ? { backgroundImage: `url(${course.banner})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: colorFor(course.id) }}
      >
        {course.banner && <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/25" />}
        <span className="relative line-clamp-2 text-center text-lg font-bold text-white drop-shadow">{course.name}</span>
        {!course.banner && <Icon name="graduation" className="mb-3 mt-auto h-14 w-14 text-white/85" />}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{course.name}</div>
          {meta?.code && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{meta.code}</span>}
        </div>
        <div className="mt-2 text-sm text-slate-400">
          {course.monthlyFee != null
            ? `${formatMoney(course.monthlyFee)} ${tr(locale, { uz: "/ oy", ru: "/ мес.", en: "/ month", de: "/ Monat" })}`
            : tr(locale, { uz: "Narx belgilanmagan", ru: "Цена не указана", en: "Price not set", de: "Preis nicht festgelegt" })}
        </div>
        <div className="mt-1 text-xs text-slate-400">{sub}</div>
      </div>
    </Link>
  );
}
