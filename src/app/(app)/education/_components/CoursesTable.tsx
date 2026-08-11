"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Card, Table, EmptyRow, Badge } from "../../_components/ui";
import { Icon } from "../../_components/Icon";

export interface CourseRow {
  id: string;
  name: string;
  isHybrid: boolean;
  programName: string;
  levelCode: string;
  daysLabel: string;
  timeLabel: string;
  studentsCount: number;
  capacity: number;
  teacherName: string;
  status: string;
  onlineLink: string | null;
  room: string;
}

const statusTone: Record<string, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PLANNED: "amber",
  FINISHED: "slate",
  CANCELLED: "red",
};

// Onlayn/offline guruhlar jadvali — holat va qidiruv bo'yicha filtrlanadi (client-side).
export default function CoursesTable({
  rows,
  isOnline,
  locale,
}: {
  rows: CourseRow[];
  isOnline: boolean;
  locale: Locale;
}) {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: "ALL", label: tr(locale, { uz: "Barchasi", ru: "Все", en: "All" }) },
    { value: "ACTIVE", label: tr(locale, { uz: "Faol", ru: "Активные", en: "Active" }) },
    { value: "PLANNED", label: tr(locale, { uz: "Rejalashtirilgan", ru: "Запланировано", en: "Planned" }) },
    { value: "FINISHED", label: tr(locale, { uz: "Yakunlangan", ru: "Завершено", en: "Finished" }) },
    { value: "CANCELLED", label: tr(locale, { uz: "Bekor qilingan", ru: "Отменено", en: "Cancelled" }) },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (q && !`${r.name} ${r.teacherName} ${r.programName} ${r.levelCode}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, search]);

  const lastColLabel = isOnline ? tr(locale, { uz: "Havola", ru: "Ссылка", en: "Link" }) : tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room" });

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700">{isOnline ? tr(locale, { uz: "Onlayn guruhlar", ru: "Онлайн-группы", en: "Online groups" }) : tr(locale, { uz: "Offline guruhlar", ru: "Офлайн-группы", en: "Offline groups" })}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(locale, { uz: "Qidirish", ru: "Поиск", en: "Search" })}
              className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Link href="/groups" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="plus" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Guruh qo'shish", ru: "Добавить группу", en: "Add group" })}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "ALL" ? rows.length : rows.filter((r) => r.status === f.value).length;
          const active = status === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              {f.label} <span className={cn("ml-1", active ? "text-white/70" : "text-slate-400")}>{count}</span>
            </button>
          );
        })}
      </div>

      <Table
        head={
          <tr>
            <th className="px-4 py-3 w-12">№</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Guruh nomi", ru: "Название группы", en: "Group name" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Kun", ru: "Дни", en: "Days" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Dars vaqti", ru: "Время урока", en: "Lesson time" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th>
            <th className="px-4 py-3">{lastColLabel}</th>
          </tr>
        }
      >
        {filtered.length === 0 ? (
          <EmptyRow colSpan={9} text={isOnline ? tr(locale, { uz: "Onlayn guruh topilmadi", ru: "Онлайн-группы не найдены", en: "No online groups found" }) : tr(locale, { uz: "Offline guruh topilmadi", ru: "Офлайн-группы не найдены", en: "No offline groups found" })} />
        ) : (
          filtered.map((g, i) => (
            <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-4 py-3 text-slate-400">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/groups/${g.id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">{g.name}</Link>
                {g.isHybrid && <Badge tone="purple">{tr(locale, { uz: "Aralash", ru: "Смешанный", en: "Hybrid" })}</Badge>}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.programName}</td>
              <td className="px-4 py-3 text-slate-500">{g.levelCode}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.daysLabel}</td>
              <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{g.timeLabel}</td>
              <td className="px-4 py-3">
                <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{g.studentsCount} / {g.capacity}</span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.teacherName}</td>
              <td className="px-4 py-3">
                {isOnline ? (
                  g.onlineLink ? (
                    <a href={g.onlineLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300">
                      <Icon name="video" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Havola", ru: "Ссылка", en: "Link" })}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )
                ) : (
                  <span className="text-slate-600 dark:text-slate-300">{g.room}</span>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400 dark:border-slate-800">
        <span>{tr(locale, { uz: "Ko'rsatilmoqda:", ru: "Показано:", en: "Showing:" })} {filtered.length} / {rows.length}</span>
        <span className="flex items-center gap-1.5">
          {tr(locale, { uz: "Holat:", ru: "Статус:", en: "Status:" })} <Badge tone={status === "ALL" ? "slate" : statusTone[status] ?? "slate"}>{STATUS_FILTERS.find((f) => f.value === status)?.label}</Badge>
        </span>
      </div>
    </Card>
  );
}
