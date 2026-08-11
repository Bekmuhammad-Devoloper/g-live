"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "../_components/Icon";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { saveTeacherSchedule, deleteTeacherSchedule, cycleTeacherAttendance, type FormState } from "./actions";

export interface VSchedule { weekdays: number[]; startTime: string | null; endTime: string | null; monthlySalary: number; startedAt: string; startedAtIso: string }
export interface VTeacher { id: string; name: string; fiksa: number; groupWeekdays: number[]; schedule: VSchedule | null }
export interface VAtt { teacherId: string; date: string; present: boolean } // date "YYYY-MM-DD"

// Ish kunlari: qo'lda jadvalда belgilangan bo'lsa — o'sha; bo'lmasa — guruhlar kunlaridan avtomatik
const effWeekdays = (t: VTeacher): number[] => (t.schedule && t.schedule.weekdays.length ? t.schedule.weekdays : t.groupWeekdays);

const WD: Record<Locale, string[]> = {
  uz: ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
const MONTHS: Record<Locale, string[]> = {
  uz: ["", "yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["", "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  en: ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const p2 = (n: number) => String(n).padStart(2, "0");
const wdName = (arr: number[], locale: Locale) => (arr.length ? arr.map((d) => WD[locale][d]).join(", ") : "—");

export default function TeacherAttendanceWorkspace({ teachers, attendance, defaultMonth, canManage, locale }: {
  teachers: VTeacher[]; attendance: VAtt[]; defaultMonth: string; canManage: boolean; locale: Locale;
}) {
  const [tab, setTab] = useState<"davomat" | "jadval" | "maosh">("davomat");
  const [month, setMonth] = useState(defaultMonth); // YYYY-MM
  const [formTeacher, setFormTeacher] = useState<VTeacher | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [year, mon] = month.split("-").map(Number);
  const days = useMemo(() => {
    const count = new Date(year, mon, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const dt = new Date(year, mon - 1, d);
      const js = dt.getDay();
      return { d, wd: js === 0 ? 7 : js, key: `${year}-${p2(mon)}-${p2(d)}` };
    });
  }, [year, mon]);

  const attMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const a of attendance) if (a.date.startsWith(month)) m.set(`${a.teacherId}|${a.date}`, a.present);
    return m;
  }, [attendance, month]);

  // hisob-kitob
  const calc = (t: VTeacher) => {
    const wds = effWeekdays(t);
    const workDays = days.filter((d) => wds.includes(d.wd)).length;
    let keldi = 0, extra = 0;
    for (const d of days) {
      const v = attMap.get(`${t.id}|${d.key}`);
      if (v === true) { wds.includes(d.wd) ? keldi++ : extra++; }
    }
    const base = t.schedule?.monthlySalary || t.fiksa;
    const asosiy = workDays > 0 ? Math.round((base * keldi) / workDays) : 0;
    return { workDays, keldi, extra, base, asosiy };
  };

  const openForm = (t: VTeacher | null) => { setFormTeacher(t); setFormOpen(true); };

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Ustozlar davomati", ru: "Посещаемость преподавателей", en: "Teacher attendance" })}</h1>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        {/* Tablar */}
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
          <TabBtn active={tab === "davomat"} onClick={() => setTab("davomat")}>{tr(locale, { uz: "Ustozlar davomati", ru: "Посещаемость преподавателей", en: "Teacher attendance" })}</TabBtn>
          <TabBtn active={tab === "jadval"} onClick={() => setTab("jadval")}>{tr(locale, { uz: "Ustozlar ish jadvali", ru: "График работы преподавателей", en: "Teacher work schedule" })}</TabBtn>
          <TabBtn active={tab === "maosh"} onClick={() => setTab("maosh")}>{tr(locale, { uz: "Oylik maosh hisoblash", ru: "Расчёт месячной зарплаты", en: "Monthly salary calculation" })}</TabBtn>
        </div>

        {/* Oy tanlash (davomat va maoshda) */}
        {tab !== "jadval" && (
          <div className="relative mb-4">
            <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
        )}

        {tab === "davomat" && <DavomatGrid teachers={teachers} days={days} attMap={attMap} calc={calc} canManage={canManage} monthName={MONTHS[locale][mon]} locale={locale} />}
        {tab === "jadval" && <JadvalTab teachers={teachers} canManage={canManage} locale={locale} onAdd={() => openForm(null)} onEdit={openForm} />}
        {tab === "maosh" && <MaoshTab teachers={teachers} calc={calc} locale={locale} />}
      </div>

      {formOpen && canManage && (
        <ScheduleForm teachers={teachers} initial={formTeacher} locale={locale} onClose={() => { setFormOpen(false); setFormTeacher(null); }} />
      )}
    </div>
  );
}

/* ───────── 1) Davomat grid ───────── */
function DavomatGrid({ teachers, days, attMap, calc, canManage, monthName, locale }: {
  teachers: VTeacher[]; days: { d: number; wd: number; key: string }[]; attMap: Map<string, boolean>;
  calc: (t: VTeacher) => { workDays: number; keldi: number; extra: number }; canManage: boolean; monthName: string; locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cellClick = (teacherId: string, key: string, working: boolean) => {
    if (!canManage || !working) return;
    start(async () => { await cycleTeacherAttendance(teacherId, key); router.refresh(); });
  };
  if (teachers.length === 0) return <Empty locale={locale} />;

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800", pending && "opacity-70")}>
      <table className="text-left text-sm">
        <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 dark:bg-slate-800/50">
          <tr>
            <th className="sticky left-0 z-10 min-w-[180px] bg-slate-50 px-4 py-2.5 dark:bg-slate-800">{tr(locale, { uz: "Ustozlar", ru: "Преподаватели", en: "Teachers" })}</th>
            {days.map((d) => (
              <th key={d.d} className="min-w-[42px] px-1 py-2 text-center">
                <div className="whitespace-nowrap text-slate-600 dark:text-slate-300">{d.d}-{monthName.slice(0, 4)}</div>
                <div className={cn("mt-0.5", d.wd >= 6 ? "text-rose-400" : "text-slate-400")}>{WD[locale][d.wd]}</div>
              </th>
            ))}
            <th className="min-w-[80px] px-2 py-2 text-center">{tr(locale, { uz: "To'liq ish kuni", ru: "Полный рабочий день", en: "Full work days" })}</th>
            <th className="min-w-[60px] px-2 py-2 text-center">{tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present" })}</th>
            <th className="min-w-[70px] px-2 py-2 text-center">{tr(locale, { uz: "Qo'shimcha", ru: "Дополнительно", en: "Extra" })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {teachers.map((t) => {
            const c = calc(t);
            const wds = effWeekdays(t);
            return (
              <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">{t.name}</td>
                {days.map((d) => {
                  const working = wds.includes(d.wd);
                  const v = attMap.get(`${t.id}|${d.key}`);
                  return (
                    <td key={d.d} className="px-1 py-1.5 text-center">
                      <button
                        onClick={() => cellClick(t.id, d.key, working)}
                        disabled={!canManage || !working}
                        className={cn("mx-auto grid h-7 w-7 place-items-center rounded-md text-xs font-bold transition",
                          !working ? "cursor-default bg-slate-50 text-slate-200 dark:bg-slate-800/40 dark:text-slate-700"
                            : v === true ? "bg-emerald-500 text-white"
                            : v === false ? "bg-rose-500 text-white"
                            : "border border-dashed border-slate-300 text-slate-300 hover:border-brand-400 hover:text-brand-400 dark:border-slate-600")}
                      >
                        {v === true ? "✓" : v === false ? "✕" : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">{c.workDays}</td>
                <td className="px-2 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{c.keldi}</td>
                <td className="px-2 py-2 text-center text-slate-500">{c.extra}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── 2) Ish jadvali ───────── */
function JadvalTab({ teachers, canManage, locale, onAdd, onEdit }: {
  teachers: VTeacher[]; canManage: boolean; locale: Locale; onAdd: () => void; onEdit: (t: VTeacher) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Ish jadvali yoki guruhi bor barcha o'qituvchi (guruh kunlari avtomatik ish kuni)
  const list = teachers.filter((t) => t.schedule || t.groupWeekdays.length);
  const del = (teacherId: string) => { if (confirm(tr(locale, { uz: "Ish jadvalini o'chirasizmi?", ru: "Удалить график работы?", en: "Delete work schedule?" }))) start(async () => { await deleteTeacherSchedule(teacherId); router.refresh(); }); };

  return (
    <div>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <button onClick={onAdd} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить новый", en: "Add new" })}</button>
        </div>
      )}
      <div className={cn("overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800", pending && "opacity-70")}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish boshlanish vaqti", ru: "Время начала работы", en: "Work start time" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Ish tugash vaqti", ru: "Время окончания работы", en: "Work end time" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Oylik maoshi", ru: "Месячная зарплата", en: "Monthly salary" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish faoliyatining boshlanishi", ru: "Начало трудовой деятельности", en: "Employment start" })}</th>
              <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.length === 0 ? (
              <tr><td colSpan={7}><Empty locale={locale} /></td></tr>
            ) : list.map((t) => {
              const sc = t.schedule;
              return (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{t.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                  {wdName(effWeekdays(t), locale)}
                  {!sc && effWeekdays(t).length > 0 && <span className="ml-1.5 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">{tr(locale, { uz: "guruhdan", ru: "из групп", en: "from groups" })}</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{sc?.startTime ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{sc?.endTime ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(sc?.monthlySalary ?? t.fiksa, locale)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{sc?.startedAt || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage && <button onClick={() => onEdit(t)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{sc ? tr(locale, { uz: "Tahrir", ru: "Изменить", en: "Edit" }) : tr(locale, { uz: "Sozlash", ru: "Настроить", en: "Set up" })}</button>}
                    {canManage && sc && <button onClick={() => del(t.id)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900">{tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}</button>}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── 3) Maosh hisoblash ───────── */
function MaoshTab({ teachers, calc, locale }: { teachers: VTeacher[]; calc: (t: VTeacher) => { workDays: number; keldi: number; base: number; asosiy: number }; locale: Locale }) {
  if (teachers.length === 0) return <Empty locale={locale} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">{tr(locale, { uz: "Ustozlar", ru: "Преподаватели", en: "Teachers" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Belgilangan maosh", ru: "Установленная зарплата", en: "Set salary" })}</th><th className="px-4 py-3 text-center">{tr(locale, { uz: "To'liq ish kuni", ru: "Полный рабочий день", en: "Full work days" })}</th>
            <th className="px-4 py-3 text-center">{tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Asosiy maosh", ru: "Основная зарплата", en: "Base salary" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Qo'shimcha tushum", ru: "Дополнительный доход", en: "Extra income" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Jami maosh", ru: "Итого зарплата", en: "Total salary" })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {teachers.map((t) => {
            const c = calc(t);
            const extra = 0;
            return (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{t.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(c.base, locale)}</td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.workDays}</td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{c.keldi}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(c.asosiy, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatMoney(extra, locale)}</td>
                <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-900 dark:text-white">{formatMoney(c.asosiy + extra, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── Ish jadvali formasi (drawer) ───────── */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7];
function ScheduleForm({ teachers, initial, locale, onClose }: { teachers: VTeacher[]; initial: VTeacher | null; locale: Locale; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTeacherSchedule, {});
  const [mounted, setMounted] = useState(false);
  // Ish kunlari guruh kunlaridan oldindan to'ldiriladi (jadval bo'lsa — o'zining kunlari)
  const [days, setDays] = useState<number[]>(initial?.schedule?.weekdays?.length ? initial.schedule.weekdays : (initial?.groupWeekdays ?? []));
  const formRef = useRef<HTMLFormElement>(null);
  const pickTeacher = (id: string) => {
    const tt = teachers.find((x) => x.id === id);
    if (tt) setDays(tt.schedule?.weekdays?.length ? tt.schedule.weekdays : tt.groupWeekdays);
  };
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (state.ok) onClose(); /* eslint-disable-next-line */ }, [state.ok]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;
  const toggle = (v: number) => setDays((d) => d.includes(v) ? d.filter((x) => x !== v) : [...d, v]);
  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} action={action} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{initial?.schedule ? tr(locale, { uz: "Ish jadvalini tahrirlash", ru: "Редактировать график работы", en: "Edit work schedule" }) : tr(locale, { uz: "Yangi ish jadvali", ru: "Новый график работы", en: "New work schedule" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={lbl}>{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })} <span className="text-rose-500">*</span></label>
            <select name="teacherId" required defaultValue={initial?.id ?? ""} disabled={!!initial} onChange={(e) => pickTeacher(e.target.value)} className={inp}>
              <option value="" disabled>{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select" })}</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days" })}</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_VALUES.map((v) => (
                <button key={v} type="button" onClick={() => toggle(v)} className={cn("h-9 w-11 rounded-lg border text-sm font-semibold transition", days.includes(v) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300")}>{WD[locale][v]}</button>
              ))}
            </div>
            <input type="hidden" name="weekdays" value={days.join(",")} />
            <p className="mt-1 text-[11px] text-slate-400">{tr(locale, { uz: "Guruh dars kunlaridan avtomatik to'ldiriladi (kerak bo'lsa o'zgartiring)", ru: "Автозаполняется по дням занятий групп (можно изменить)", en: "Auto-filled from group lesson days (editable)" })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Ish boshlanish vaqti", ru: "Время начала работы", en: "Work start time" })}</label><input name="startTime" type="time" defaultValue={initial?.schedule?.startTime ?? ""} className={inp} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Ish tugash vaqti", ru: "Время окончания работы", en: "Work end time" })}</label><input name="endTime" type="time" defaultValue={initial?.schedule?.endTime ?? ""} className={inp} /></div>
          </div>
          <div><label className={lbl}>{tr(locale, { uz: "Oylik maoshi (so'm)", ru: "Месячная зарплата (сум)", en: "Monthly salary (so'm)" })}</label><input name="monthlySalary" type="number" min="0" defaultValue={initial?.schedule?.monthlySalary ?? initial?.fiksa ?? 0} className={inp} /></div>
          <div><label className={lbl}>{tr(locale, { uz: "Ish faoliyatining boshlanishi", ru: "Начало трудовой деятельности", en: "Employment start" })}</label><input name="startedAt" type="date" defaultValue={initial?.schedule?.startedAtIso ?? ""} className={inp} /></div>
          {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "Information is incomplete." })}</p>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </form>
    </div>, document.body);
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("-mb-px whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium transition", active ? "border-brand-600 text-brand-600 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>{children}</button>;
}
function Empty({ locale }: { locale: Locale }) {
  return <div className="py-12 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty" })}</div>;
}
