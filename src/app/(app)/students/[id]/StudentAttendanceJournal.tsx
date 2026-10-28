"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { getStudentAttendanceJournal } from "./journalActions";
import type { StudentJournal } from "./journal";

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
// Hafta kunlari: 0 = Yakshanba (JS getDay)
const WEEKDAYS: Record<Locale, string[]> = {
  uz: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
};

// Ranglar guruh sahifasidagi davomat jurnali (AttendanceJournal) bilan bir xil
const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white",
  LATE: "bg-amber-500 text-white",
  EXCUSED: "bg-sky-500 text-white",
  ABSENT: "bg-rose-500 text-white",
  ONLINE: "bg-violet-500 text-white",
  MAKEUP: "bg-indigo-500 text-white",
  UNMARKED: "border border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500",
  FUTURE: "border border-dashed border-slate-200 text-transparent dark:border-slate-700",
};
const LEGEND_DOT: Record<string, string> = {
  ...STATUS_STYLE,
  UNMARKED: "border border-slate-300 dark:border-slate-600",
  FUTURE: "border border-dashed border-slate-300 dark:border-slate-600",
};

/**
 * O'quvchi profilidagi oylik davomat jurnali (faqat ko'rish): har bir guruh uchun
 * oyning barcha dars sanalari va o'quvchining har kungi holati. Belgilash — guruh sahifasida.
 */
export function StudentAttendanceJournal({ studentId, locale, initial }: { studentId: string; locale: Locale; initial: StudentJournal }) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [ym, setYm] = useState({ y: initial.year, m: initial.month0 });
  const [data, setData] = useState<StudentJournal | null>(initial);
  const [failed, setFailed] = useState(false);
  const [loading, startLoad] = useTransition();
  const reqRef = useRef(0);

  const isInitial = (y: number, m: number) => y === initial.year && m === initial.month0;

  // Sahifa yangilanganda (router.refresh) joriy oy ma'lumoti ham yangilanadi
  useEffect(() => {
    if (isInitial(ym.y, ym.m)) { reqRef.current++; setData(initial); setFailed(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const go = (y: number, m: number) => {
    setYm({ y, m });
    if (isInitial(y, m)) { reqRef.current++; setData(initial); setFailed(false); return; }
    const req = ++reqRef.current;
    startLoad(async () => {
      const r = await getStudentAttendanceJournal(studentId, y, m);
      if (req !== reqRef.current) return;
      setFailed(!r.ok);
      setData(r.ok ? r.data ?? null : null);
    });
  };
  const shift = (d: number) => { const t = new Date(ym.y, ym.m + d, 1); go(t.getFullYear(), t.getMonth()); };

  const [ty, tm] = initial.today.split("-").map(Number);
  const isCurrent = ym.y === ty && ym.m === tm - 1;

  const label = (s: string) =>
    s === "PRESENT" ? L("Bor edi", "Был", "Present", "Anwesend")
    : s === "ABSENT" ? L("Yo'q", "Нет", "Absent", "Abwesend")
    : s === "LATE" ? L("Kechikdi", "Опоздал", "Late", "Verspätet")
    : s === "EXCUSED" ? L("Sababli", "Уважит.", "Excused", "Entschuldigt")
    : s === "ONLINE" ? L("Onlayn", "Онлайн", "Online", "Online")
    : s === "MAKEUP" ? L("Qayta ishlash", "Отработка", "Make-up", "Nachholstunde")
    : s === "UNMARKED" ? L("Belgilanmagan", "Не отмечен", "Not marked", "Nicht erfasst")
    : s === "FUTURE" ? L("Kelajak", "Предстоит", "Upcoming", "Bevorstehend")
    : s === "OUT" ? L("Guruhda emas", "Не в группе", "Not in group", "Nicht in der Gruppe") : s;

  const months = MONTHS[locale] ?? MONTHS.uz;
  const wds = WEEKDAYS[locale] ?? WEEKDAYS.uz;
  const dayParts = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return { wd: wds[new Date(y, m - 1, d, 12).getDay()], d, full: `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}` };
  };

  const groups = data?.groups ?? [];
  const seen = new Set(groups.flatMap((g) => g.days.map((d) => d.st)));
  const legend = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "ONLINE", ...(seen.has("MAKEUP") ? ["MAKEUP"] : []), "UNMARKED", "FUTURE"];
  const navBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      {/* Sarlavha + oy tanlovi + izoh */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" /> {L("Oylik davomat", "Посещаемость за месяц", "Monthly attendance", "Monatliche Anwesenheit")}
        </h3>
        <button type="button" onClick={() => go(ty, tm - 1)} disabled={isCurrent} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", isCurrent ? "border-slate-200 text-slate-300 dark:border-slate-700" : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300")}>
          {L("Joriy", "Текущий", "Current", "Aktuell")}
        </button>
        <button type="button" onClick={() => shift(-1)} className={navBtn} aria-label={L("Oldingi oy", "Предыдущий месяц", "Previous month", "Vorheriger Monat")}><Icon name="chevronDown" className="h-4 w-4 rotate-90" /></button>
        <span className="min-w-[120px] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
          {months[ym.m]} {ym.y}
        </span>
        <button type="button" onClick={() => shift(1)} className={navBtn} aria-label={L("Keyingi oy", "Следующий месяц", "Next month", "Nächster Monat")}><Icon name="chevronDown" className="h-4 w-4 -rotate-90" /></button>
        {loading && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-400" />}
        <div className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {legend.map((s) => (
            <span key={s} className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded-full", LEGEND_DOT[s])} />{label(s)}</span>
          ))}
        </div>
      </div>

      {failed && (
        <p className="py-6 text-center text-sm text-rose-500">{L("Davomatni yuklab bo'lmadi.", "Не удалось загрузить посещаемость.", "Could not load attendance.", "Anwesenheit konnte nicht geladen werden.")}</p>
      )}

      {!failed && data && groups.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">{L("Bu oyda o'quvchi hech qaysi guruhda bo'lmagan.", "В этом месяце ученик не состоял ни в одной группе.", "The student was not in any group this month.", "Der Schüler war diesen Monat in keiner Gruppe.")}</p>
      )}

      {groups.length > 0 && (
        <div className={cn("divide-y divide-slate-100 dark:divide-slate-800", loading && "opacity-60")}>
          {groups.map((g) => (
            <div key={g.id} className="py-3 first:pt-0 last:pb-0">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/groups/${g.id}`} className="truncate text-sm font-semibold text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{g.name}</Link>
                    {!g.active && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                        {L("chiqarilgan", "исключён", "removed", "entfernt")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{g.course}</span>
                    {g.teacher && <span className="flex items-center gap-1"><Icon name="user" className="h-3 w-3" />{g.teacher}</span>}
                  </div>
                </div>
                {/* Oylik xulosa */}
                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold tabular-nums">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{L("Keldi", "Пришёл", "Came", "Anwesend")}: {g.came}</span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{L("Kelmadi", "Не пришёл", "Missed", "Gefehlt")}: {g.missed}</span>
                  {g.excused > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">{label("EXCUSED")}: {g.excused}</span>}
                  {g.unmarked > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{label("UNMARKED")}: {g.unmarked}</span>}
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">{L("Jami", "Всего", "Total", "Gesamt")}: {g.total} {L("dars", "занятий", "lessons", "Stunden")}</span>
                </div>
              </div>

              {g.days.length === 0 ? (
                <p className="text-xs text-slate-400">{L("Bu oyda dars kunlari yo'q (guruh jadvali yoki davri bo'yicha).", "В этом месяце нет учебных дней.", "No lesson days this month.", "Keine Unterrichtstage in diesem Monat.")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {g.days.map((d) => {
                    const p = dayParts(d.date);
                    const today = d.date === data?.today;
                    return (
                      <div key={d.date} title={`${p.full} · ${label(d.st)}`} className="flex w-[64px] flex-col items-center gap-1">
                        <span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
                          today ? "bg-brand-600 text-white" : d.st === "FUTURE" || d.st === "OUT" ? "text-slate-400" : "text-slate-600 dark:text-slate-300")}>
                          {p.wd} {p.d}
                        </span>
                        {d.st === "OUT" ? (
                          <span className="inline-flex h-6 items-center text-xs text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <span className={cn("inline-flex h-6 w-full items-center justify-center truncate rounded-md px-1 text-[10px] font-semibold", STATUS_STYLE[d.st] ?? "bg-slate-400 text-white")}>
                            {d.st === "UNMARKED" ? "?" : d.st === "FUTURE" ? "·" : label(d.st)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
