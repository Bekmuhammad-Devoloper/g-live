"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "../../_components/Icon";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { getGroupAttendance, markStudentAttendance, markAllPresent } from "./attendanceActions";

const p2 = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

export function GroupAttendance({ groupId, students, locale }: { groupId: string; students: { id: string; name: string; blocked?: boolean; lessonsThisMonth?: number }[]; locale: Locale }) {
  const [date, setDate] = useState(todayISO());
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, startLoad] = useTransition();
  const [, startSave] = useTransition();
  const [blockedNotice, setBlockedNotice] = useState<{ name: string; lessons: number } | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);

  useEffect(() => {
    let alive = true;
    startLoad(async () => {
      const r = await getGroupAttendance(groupId, date);
      if (alive && r.ok) setMap(r.map ?? {});
    });
    return () => { alive = false; };
  }, [groupId, date]);

  const mark = (id: string, status: string) => {
    const willClear = map[id] === status;
    const prev = map[id];
    setMap((m) => { const n = { ...m }; if (willClear) delete n[id]; else n[id] = status; return n; }); // optimistik
    startSave(async () => {
      const r = await markStudentAttendance(groupId, date, id, status);
      if (r.blocked) {
        // Server bloklаdi — optimistik o'zgarishni bekor qilamiz va sababini ko'rsatamiz
        setMap((m) => { const n = { ...m }; if (prev === undefined) delete n[id]; else n[id] = prev; return n; });
        const st = students.find((x) => x.id === id);
        setBlockedNotice({ name: st?.name ?? "", lessons: r.lessonsThisMonth ?? 0 });
      }
    });
  };
  const allPresent = () => {
    setMap((m) => { const n = { ...m }; for (const s of students) if (!n[s.id] && !s.blocked) n[s.id] = "PRESENT"; return n; });
    startSave(async () => {
      const r = await markAllPresent(groupId, date);
      setSkippedCount(r.skippedBlocked ?? 0);
    });
  };

  const present = students.filter((s) => map[s.id] === "PRESENT" || map[s.id] === "LATE").length;
  const absent = students.filter((s) => map[s.id] === "ABSENT").length;
  const unmarked = students.length - present - absent;

  const isToday = date === todayISO();

  return (
    <div>
      {/* Bloklangan urinish haqida ogohlantirish */}
      {blockedNotice && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: `${blockedNotice.name} — shu oy ${blockedNotice.lessons} dars o'tildi, to'lov qilinmagan. Avval to'lovni qabul qiling.`,
              ru: `${blockedNotice.name} — в этом месяце проведено ${blockedNotice.lessons} уроков, оплата не произведена. Сначала примите оплату.`,
              en: `${blockedNotice.name} — ${blockedNotice.lessons} lessons this month, unpaid. Accept payment first.`,
            })}
          </span>
          <button onClick={() => setBlockedNotice(null)} className="shrink-0 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {skippedCount > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: `${skippedCount} ta o'quvchi to'lov qilinmagani sabab "Hammasi bor"ga qo'shilmadi.`,
              ru: `${skippedCount} учеников не отмечены из-за неоплаты.`,
              en: `${skippedCount} student(s) skipped due to unpaid mandatory payment.`,
            })}
          </span>
          <button onClick={() => setSkippedCount(0)} className="shrink-0 text-amber-400 hover:text-amber-600">✕</button>
        </div>
      )}

      {/* Sana + hammasi bor + jamlanma */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="calendar" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        {isToday && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">{tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today" })}</span>}
        <button onClick={allPresent} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
          ✓ {tr(locale, { uz: "Hammasi bor", ru: "Все присутствуют", en: "All present" })}
        </button>
        <div className={cn("ml-auto flex items-center gap-2.5 text-xs", loading && "opacity-50")}>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "Bor", ru: "Есть", en: "Present" })}: {present}</span>
          <span className="font-semibold text-rose-500">{tr(locale, { uz: "Yo'q", ru: "Нет", en: "Absent" })}: {absent}</span>
          <span className="text-slate-400">{tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Unmarked" })}: {unmarked}</span>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">{tr(locale, { uz: "O'quvchi yo'q", ru: "Нет учеников", en: "No students" })}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {students.map((s) => {
            const st = map[s.id];
            const isAttending = st === "PRESENT" || st === "LATE";
            // Bloklangan holat faqat hali "keldi" deb belgilanmagan bo'lsa amal qiladi (mavjud belgini o'chirish/o'zgartirish erkin)
            const isBlocked = !!s.blocked && !isAttending;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">{s.name}</span>
                  {isBlocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400" title={tr(locale, { uz: `Shu oy ${s.lessonsThisMonth} dars o'tildi — to'lov majburiy`, ru: `В этом месяце ${s.lessonsThisMonth} уроков — оплата обязательна`, en: `${s.lessonsThisMonth} lessons this month — payment required` })}>
                      <Icon name="alert" className="h-3 w-3" /> {tr(locale, { uz: "To'lov kerak", ru: "Нужна оплата", en: "Payment needed" })}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => mark(s.id, "PRESENT")}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition",
                      st === "PRESENT" ? "border-emerald-500 bg-emerald-500 text-white" : isBlocked ? "border-rose-200 text-rose-300 hover:border-rose-400 hover:text-rose-500 dark:border-rose-900/40" : "border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-700")}
                    title={isBlocked ? tr(locale, { uz: "To'lov majburiy — avval to'lovni qabul qiling", ru: "Оплата обязательна — сначала примите оплату", en: "Payment required first" }) : tr(locale, { uz: "Bor (keldi)", ru: "Присутствует", en: "Present" })}
                  >✓</button>
                  <button
                    onClick={() => mark(s.id, "ABSENT")}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition",
                      st === "ABSENT" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-500 dark:border-slate-700")}
                    title={tr(locale, { uz: "Yo'q (kelmadi)", ru: "Отсутствует", en: "Absent" })}
                  >✕</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
