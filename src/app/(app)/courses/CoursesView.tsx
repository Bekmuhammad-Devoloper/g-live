"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/constants";
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

export default function CoursesView({ courses }: { courses: VCourse[] }) {
  const [meta, setMeta] = useState<Record<string, CourseMeta>>({});
  const [addOpen, setAddOpen] = useState(false);

  // Kurs kodi va davomiyligi hali brauzer xotirasida; narx esa bazadan keladi
  useEffect(() => { setMeta(loadMeta()); }, []);

  return (
    <div>
      {/* Sarlavha + qo'shish tugmasi */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-5 dark:border-slate-800">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kurslar</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-[#1f3a5f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#152a45]"
        >
          Yangisini qo&apos;shish
        </button>
      </div>

      {/* Kartochkalar */}
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-20 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div className="text-4xl opacity-30">📚</div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Hozircha kurs yo&apos;q. &quot;Yangisini qo&apos;shish&quot; tugmasi orqali qo&apos;shing.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} meta={meta[c.id]} />
          ))}
        </div>
      )}

      <CourseFormDrawer mode="create" open={addOpen} onClose={() => setAddOpen(false)} onSaved={(id, m) => setMeta(saveMetaFor(id, m))} />
    </div>
  );
}

function CourseCard({ course, meta }: { course: VCourse; meta?: CourseMeta }) {
  const sub = meta?.months ? `${meta.months} oy` : `${course.levels} daraja · ${course.groups} guruh`;
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
          {course.monthlyFee != null ? `${formatMoney(course.monthlyFee)} / oy` : "Narx belgilanmagan"}
        </div>
        <div className="mt-1 text-xs text-slate-400">{sub}</div>
      </div>
    </Link>
  );
}
