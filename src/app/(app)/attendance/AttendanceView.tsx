"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import { Badge } from "../_components/ui";
import { markAttendance, confirmLesson } from "./actions";

export interface VAttStudent { id: string; name: string; status: string | null }
export interface VLesson {
  id: string;
  dateLabel: string;
  groupName: string;
  topic: string | null;
  present: number;
  total: number;
  confirmed: boolean;
  students: VAttStudent[];
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "#16a34a",
  LATE: "#d97706",
  ABSENT: "#dc2626",
  EXCUSED: "#0891b2",
  ONLINE: "#7c3aed",
  MAKEUP: "#4148ef",
};

export default function AttendanceView({ lessons, canMark, locale }: { lessons: VLesson[]; canMark: boolean; locale: Locale }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Mavzu", ru: "Тема", en: "Topic", de: "Thema" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Qatnashdi", ru: "Присутствовал", en: "Attended", de: "Anwesend" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Tasdiqlangan", ru: "Подтверждено", en: "Confirmed", de: "Bestätigt" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lessons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">{tr(locale, { uz: "Ma'lumot yo'q", ru: "Нет данных", en: "No data", de: "Keine Daten" })}</td>
              </tr>
            ) : (
              lessons.map((l) => {
                const isOpen = open === l.id;
                return (
                  <LessonRows
                    key={l.id}
                    lesson={l}
                    isOpen={isOpen}
                    onToggle={() => setOpen(isOpen ? null : l.id)}
                    canMark={canMark}
                    locale={locale}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LessonRows({ lesson: l, isOpen, onToggle, canMark, locale }: {
  lesson: VLesson; isOpen: boolean; onToggle: () => void; canMark: boolean; locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setStatus = (studentId: string, status: string) =>
    start(async () => { await markAttendance(l.id, studentId, status); router.refresh(); });

  const confirm = () =>
    start(async () => { await confirmLesson(l.id); router.refresh(); });

  return (
    <>
      <tr className={cn("cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50", isOpen && "bg-slate-50/70 dark:bg-slate-800/40")} onClick={onToggle}>
        <td className="px-3 py-3 text-slate-400">
          <Icon name="chevronDown" className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{l.dateLabel}</td>
        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{l.groupName}</td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.topic ?? "—"}</td>
        <td className="px-4 py-3"><Badge tone="green">{l.present} / {l.total}</Badge></td>
        <td className="px-4 py-3">{l.confirmed ? <Badge tone="green">{tr(locale, { uz: "Ha", ru: "Да", en: "Yes", de: "Ja" })}</Badge> : <Badge tone="amber">{tr(locale, { uz: "Kutilmoqda", ru: "Ожидается", en: "Pending", de: "Ausstehend" })}</Badge>}</td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/40 dark:bg-slate-800/20">
          <td colSpan={6} className="px-4 py-4">
            {l.students.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">{tr(locale, { uz: "Guruhda o'quvchi yo'q", ru: "В группе нет учеников", en: "No students in the group", de: "Keine Schüler in der Gruppe" })}</p>
            ) : (
              <div className={cn("space-y-1.5", pending && "opacity-60")}>
                {l.students.map((st) => (
                  <div key={st.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.status ? STATUS_COLOR[st.status] ?? "#94a3b8" : "#cbd5e1" }} />
                      {st.name}
                    </span>
                    {canMark ? (
                      <select
                        value={st.status ?? ""}
                        disabled={pending}
                        onChange={(e) => setStatus(st.id, e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="" disabled>{tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht markiert" })}</option>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>{label(ATTENDANCE_STATUS_LABELS, s, locale)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-medium" style={{ color: st.status ? STATUS_COLOR[st.status] ?? "#64748b" : "#94a3b8" }}>
                        {st.status ? label(ATTENDANCE_STATUS_LABELS, st.status, locale) : "—"}
                      </span>
                    )}
                  </div>
                ))}
                {canMark && (
                  <div className="flex justify-end pt-1.5">
                    <button
                      onClick={confirm}
                      disabled={pending || l.confirmed}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Icon name="filecheck" className="h-4 w-4" /> {l.confirmed ? tr(locale, { uz: "Tasdiqlangan", ru: "Подтверждено", en: "Confirmed", de: "Bestätigt" }) : tr(locale, { uz: "Ro'yxatni tasdiqlash", ru: "Подтвердить список", en: "Confirm list", de: "Liste bestätigen" })}
                    </button>
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
