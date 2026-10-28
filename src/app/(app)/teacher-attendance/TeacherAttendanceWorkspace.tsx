"use client";

import DateInput from "@/app/(app)/_components/DateInput";
import { confirmDelete } from "../_components/dialogs";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "../_components/Icon";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { saveTeacherSchedule, deleteTeacherSchedule, setTeacherAttendance, type FormState } from "./actions";

export type TStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export interface VSchedule { weekdays: number[]; startTime: string | null; endTime: string | null; monthlySalary: number; startedAt: string; startedAtIso: string }
/** Guruh dars vaqti: hafta kunlari, "HH:mm" oralig'i va guruh davri ("" — chegarasiz) */
export interface VSlot { wd: number[]; start: string; end: string; from: string; to: string }
export interface VTeacher { id: string; name: string; fiksa: number; groupWeekdays: number[]; slots: VSlot[]; schedule: VSchedule | null }
export interface VAtt { teacherId: string; date: string; status: TStatus } // date "YYYY-MM-DD"

// Ish kunlari: qo'lda jadvalda belgilangan bo'lsa — o'sha; bo'lmasa — guruhlar kunlaridan avtomatik
const effWeekdays = (t: VTeacher): number[] => (t.schedule && t.schedule.weekdays.length ? t.schedule.weekdays : t.groupWeekdays);

const WD: Record<Locale, string[]> = {
  uz: ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  de: ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const MONTHS: Record<Locale, string[]> = {
  uz: ["", "yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["", "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  en: ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const MONTHS_SHORT: Record<Locale, string[]> = {
  uz: ["", "yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"],
  ru: ["", "янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};
const p2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const wdName = (arr: number[], locale: Locale) => (arr.length ? arr.map((d) => WD[locale][d]).join(", ") : "—");
const shortDate = (iso: string, locale: Locale) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS_SHORT[locale][m]}`; };

/* ───────── Holatlar ───────── */
const STATUS_ORDER: TStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];
const STATUS_STYLE: Record<TStatus, string> = {
  PRESENT: "bg-emerald-500 text-white",
  LATE: "bg-amber-500 text-white",
  ABSENT: "bg-rose-500 text-white",
  EXCUSED: "bg-sky-500 text-white",
};
const isCame = (s: TStatus | undefined) => s === "PRESENT" || s === "LATE";
const statusLabel = (s: TStatus, locale: Locale) =>
  s === "PRESENT" ? tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present", de: "Anwesend" })
  : s === "LATE" ? tr(locale, { uz: "Kechikdi", ru: "Опоздал", en: "Late", de: "Verspätet" })
  : s === "ABSENT" ? tr(locale, { uz: "Kelmadi", ru: "Не пришёл", en: "Absent", de: "Abwesend" })
  : tr(locale, { uz: "Sababli", ru: "Уважительная", en: "Excused", de: "Entschuldigt" });
// Jurnal katagidagi qisqa belgi
const statusGlyph = (s: TStatus, locale: Locale) =>
  s === "PRESENT" ? "✓"
  : s === "ABSENT" ? "✕"
  : s === "LATE" ? tr(locale, { uz: "K", ru: "О", en: "L", de: "V" })
  : tr(locale, { uz: "S", ru: "У", en: "E", de: "E" });

/* ───────── Ish soatlari ───────── */
const toMin = (hhmm: string | null | undefined) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
// "HH:mm" oralig'i daqiqada; tugash boshlanishdan oldin bo'lsa — yarim tundan oshadi
const spanMin = (a: string | null | undefined, b: string | null | undefined) => {
  const x = toMin(a), y = toMin(b);
  if (x === null || y === null || x === y) return 0;
  return y > x ? y - x : y + 1440 - x;
};
// Shu sanada o'tiladigan guruh darslari (hafta kuni + guruh davri)
const slotsOn = (t: VTeacher, date: string, wd: number) =>
  t.slots.filter((s) => s.wd.includes(wd) && (!s.from || date >= s.from) && (!s.to || date <= s.to));
// Kunlik ish vaqti: ish jadvalidagi soatlar, bo'lmasa shu kungi guruh darslari yig'indisi
const dayMinutes = (t: VTeacher, date: string, wd: number) => {
  const own = spanMin(t.schedule?.startTime, t.schedule?.endTime);
  if (own) return own;
  return slotsOn(t, date, wd).reduce((n, s) => n + spanMin(s.start, s.end), 0);
};
const fmtHours = (min: number) => { const h = Math.round(min / 6) / 10; return Number.isInteger(h) ? String(h) : h.toFixed(1); };

interface Day { d: number; wd: number; key: string; weekend: boolean; today: boolean; future: boolean }
interface Totals { workDays: number; keldi: number; extra: number; late: number; absent: number; excused: number; minutes: number; base: number; asosiy: number }
interface Menu { teacherId: string; name: string; date: string; future: boolean; x: number; y: number; up: boolean }

const buildMarks = (list: VAtt[]) => {
  const m = new Map<string, TStatus>();
  for (const a of list) m.set(`${a.teacherId}|${a.date}`, a.status);
  return m;
};

export default function TeacherAttendanceWorkspace({ teachers, attendance, defaultMonth, todayISO, canManage, canMark, locale }: {
  teachers: VTeacher[]; attendance: VAtt[]; defaultMonth: string; todayISO: string; canManage: boolean; canMark: boolean; locale: Locale;
}) {
  const router = useRouter();
  const [section, setSection] = useState<"jadval" | "maosh">("jadval");
  const [view, setView] = useState<"month" | "day">("month");
  const [month, setMonth] = useState(defaultMonth); // YYYY-MM
  const [day, setDay] = useState(todayISO); // kunlik ko'rinish sanasi
  const [formTeacher, setFormTeacher] = useState<VTeacher | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [marks, setMarks] = useState(() => buildMarks(attendance));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);

  // Server ma'lumoti yangilanganda (router.refresh) mahalliy holat qayta quriladi
  useEffect(() => setMarks(buildMarks(attendance)), [attendance]);

  const [year, mon] = month.split("-").map(Number);
  const days = useMemo<Day[]>(() => {
    const count = new Date(year, mon, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const js = new Date(year, mon - 1, d).getDay();
      const wd = js === 0 ? 7 : js;
      const key = `${year}-${p2(mon)}-${p2(d)}`;
      return { d, wd, key, weekend: wd >= 6, today: key === todayISO, future: key > todayISO };
    });
  }, [year, mon, todayISO]);

  // Oylik hisob (maosh hisobi ham shundan): keldi = ish kunidagi PRESENT/LATE
  const calc = (t: VTeacher): Totals => {
    const wds = effWeekdays(t);
    let workDays = 0, keldi = 0, extra = 0, late = 0, absent = 0, excused = 0, minutes = 0;
    for (const d of days) {
      const working = wds.includes(d.wd);
      if (working) workDays++;
      const st = marks.get(`${t.id}|${d.key}`);
      if (!st) continue;
      if (isCame(st)) {
        if (working) keldi++; else extra++;
        if (st === "LATE") late++;
        minutes += dayMinutes(t, d.key, d.wd);
      } else if (st === "ABSENT") absent++;
      else excused++;
    }
    const base = t.schedule?.monthlySalary || t.fiksa;
    const asosiy = workDays > 0 ? Math.round((base * keldi) / workDays) : 0;
    return { workDays, keldi, extra, late, absent, excused, minutes, base, asosiy };
  };

  // Belgilash: ish kuni yoki mavjud belgi (avtomatik qo'yilganini tuzatish uchun)
  const markable = (t: VTeacher, key: string, wd: number) => canMark && (effWeekdays(t).includes(wd) || marks.has(`${t.id}|${key}`));

  const errText = (e?: string) =>
    e === "future" ? tr(locale, { uz: "Kelajak sanaga faqat «Sababli» belgisi qo'yiladi.", ru: "На будущую дату можно поставить только «Уважительная».", en: "Only “Excused” can be set for a future date.", de: "Für ein zukünftiges Datum ist nur „Entschuldigt“ möglich." })
    : e === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." })
    : e === "notfound" ? tr(locale, { uz: "O'qituvchi joriy filialda topilmadi.", ru: "Преподаватель не найден в текущем филиале.", en: "Teacher not found in the current branch.", de: "Lehrer in der aktuellen Filiale nicht gefunden." })
    : tr(locale, { uz: "Saqlab bo'lmadi.", ru: "Не удалось сохранить.", en: "Could not save.", de: "Speichern fehlgeschlagen." });

  // Holatni o'rnatish; joriy holat qayta tanlansa — belgi olib tashlanadi
  const setMark = (teacherId: string, date: string, status: TStatus | null) => {
    setMenu(null);
    const k = `${teacherId}|${date}`;
    const prev = marks.get(k) ?? null;
    const next = prev === status ? null : status;
    if (prev === next) return;
    const apply = (v: TStatus | null) => setMarks((m) => { const n = new Map(m); if (v) n.set(k, v); else n.delete(k); return n; });
    apply(next);
    startSave(async () => {
      const r = await setTeacherAttendance(teacherId, date, next);
      if (!r.ok) { apply(prev); setNotice(errText(r.error)); return; }
      router.refresh();
    });
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, t: VTeacher, d: Day) => {
    if (!markable(t, d.key, d.wd)) return;
    if (menu && menu.teacherId === t.id && menu.date === d.key) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const half = 160;
    const x = Math.max(Math.min(r.left + r.width / 2, window.innerWidth - half - 8), Math.min(half + 8, window.innerWidth / 2));
    const up = r.bottom + 110 > window.innerHeight;
    setMenu({ teacherId: t.id, name: t.name, date: d.key, future: d.future, x, y: up ? r.top - 6 : r.bottom + 6, up });
  };

  // Menyu: tashqarida bosish, Escape, aylantirish yoki o'lcham o'zgarsa yopiladi
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (popRef.current?.contains(el) || el?.closest("[data-tcell]")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const goMonth = (delta: number) => {
    const dt = new Date(year, mon - 1 + delta, 1);
    const m = `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}`;
    setMonth(m);
    setDay(todayISO.startsWith(m) ? todayISO : `${m}-01`);
    setMenu(null);
  };
  const shiftDay = (delta: number) => {
    const [y, m, d] = day.split("-").map(Number);
    const key = isoOf(new Date(y, m - 1, d + delta));
    setDay(key);
    setMonth(key.slice(0, 7));
  };
  const openDay = (key: string) => { setDay(key); setMonth(key.slice(0, 7)); setView("day"); setMenu(null); };
  const goToday = () => { setMonth(todayISO.slice(0, 7)); setDay(todayISO); setMenu(null); };

  const isCurrent = view === "month" ? month === todayISO.slice(0, 7) : day === todayISO;
  const monthTitle = `${MONTHS[locale][mon]} ${year}`;
  const dayWd = (() => { const js = new Date(day + "T12:00:00").getDay(); return js === 0 ? 7 : js; })();
  const dayTitle = `${shortDate(day, locale)} ${day.slice(0, 4)}, ${WD[locale][dayWd]}`;
  const navBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
  const openForm = (t: VTeacher | null) => { setFormTeacher(t); setFormOpen(true); };
  const menuStatus = menu ? marks.get(`${menu.teacherId}|${menu.date}`) : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Ustozlar davomati", ru: "Посещаемость преподавателей", en: "Teacher attendance", de: "Anwesenheit der Lehrer" })}</h1>

      {/* ── Davomat jurnali (doimiy ko'rinadi) ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={goToday} disabled={isCurrent} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", isCurrent ? "border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600" : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300")}>
            {view === "month" ? tr(locale, { uz: "Joriy oy", ru: "Текущий месяц", en: "This month", de: "Aktueller Monat" }) : tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" })}
          </button>
          <button type="button" onClick={() => (view === "month" ? goMonth(-1) : shiftDay(-1))} className={navBtn} aria-label="prev"><Icon name="chevronDown" className="h-4 w-4 rotate-90" /></button>
          <span className="min-w-[130px] text-center text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{view === "month" ? monthTitle : dayTitle}</span>
          <button type="button" onClick={() => (view === "month" ? goMonth(1) : shiftDay(1))} className={navBtn} aria-label="next"><Icon name="chevronDown" className="h-4 w-4 -rotate-90" /></button>
          {saving && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-400" />}
          <div className="ml-auto inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(["month", "day"] as const).map((v) => (
              <button key={v} type="button" onClick={() => { setView(v); setMenu(null); }} className={cn("rounded-md px-3 py-1 text-xs font-semibold transition", view === v ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
                {v === "month" ? tr(locale, { uz: "Oylik jurnal", ru: "Журнал за месяц", en: "Monthly journal", de: "Monatsjournal" }) : tr(locale, { uz: "Kunlik", ru: "За день", en: "Daily", de: "Täglich" })}
              </button>
            ))}
          </div>
        </div>

        <Legend locale={locale} />

        {notice && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
            <span className="flex items-center gap-2"><Icon name="alert" className="h-4 w-4 shrink-0" />{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {teachers.length === 0 ? <Empty locale={locale} />
          : view === "month" ? <JournalGrid teachers={teachers} days={days} marks={marks} calc={calc} markable={markable} onCell={openMenu} onDay={openDay} menu={menu} locale={locale} />
          : <DayView teachers={teachers} date={day} wd={dayWd} future={day > todayISO} marks={marks} canMark={canMark} markable={markable} onSet={setMark} locale={locale} />}

        <p className="mt-2 text-[11px] text-slate-400">
          {canMark
            ? tr(locale, { uz: "Katakni bosib holatni tanlang (qayta tanlansa belgi olib tashlanadi). Ustoz o'z guruhida davomat o'tkazganda «Keldi» avtomatik tushadi. Sana ustiga bosilsa — kunlik ko'rinish.", ru: "Нажмите на ячейку, чтобы выбрать статус (повторный выбор снимает отметку). «Пришёл» ставится автоматически, когда преподаватель отмечает посещаемость своей группы. Нажатие на дату — дневной вид.", en: "Click a cell to choose a status (choosing it again clears it). “Present” is set automatically when the teacher takes attendance in their own group. Click a date for the daily view.", de: "Klicken Sie auf eine Zelle, um den Status zu wählen (erneute Auswahl entfernt ihn). „Anwesend“ wird automatisch gesetzt, wenn der Lehrer die Anwesenheit seiner Gruppe erfasst. Datum anklicken für die Tagesansicht." })
            : tr(locale, { uz: "Faqat ko'rish. «Keldi» ustoz o'z guruhida davomat o'tkazganda avtomatik tushadi; boshqa holatlarni menejer yoki direktor belgilaydi.", ru: "Только просмотр. «Пришёл» ставится автоматически при отметке посещаемости группы; остальные статусы ставит менеджер или директор.", en: "View only. “Present” is set automatically when the teacher takes group attendance; other statuses are set by a manager or director.", de: "Nur Ansicht. „Anwesend“ wird automatisch bei der Gruppenanwesenheit gesetzt; andere Status setzt ein Manager oder Direktor." })}
        </p>
      </div>

      {/* ── Ish jadvali va maosh hisobi ── */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 dark:border-slate-800">
          <TabBtn active={section === "jadval"} onClick={() => setSection("jadval")}>{tr(locale, { uz: "Ustozlar ish jadvali", ru: "График работы преподавателей", en: "Teacher work schedule", de: "Arbeitsplan der Lehrer" })}</TabBtn>
          <TabBtn active={section === "maosh"} onClick={() => setSection("maosh")}>{tr(locale, { uz: "Oylik maosh hisoblash", ru: "Расчёт месячной зарплаты", en: "Monthly salary calculation", de: "Berechnung des Monatsgehalts" })}</TabBtn>
          {section === "maosh" && (
            <span className="mb-2.5 ml-auto text-xs text-slate-500">
              {tr(locale, { uz: "Hisob oyi", ru: "Месяц расчёта", en: "Billing month", de: "Abrechnungsmonat" })}: <b className="capitalize text-slate-700 dark:text-slate-200">{monthTitle}</b>
            </span>
          )}
        </div>
        {section === "jadval" && <JadvalTab teachers={teachers} canManage={canManage} locale={locale} onAdd={() => openForm(null)} onEdit={openForm} />}
        {section === "maosh" && <MaoshTab teachers={teachers} calc={calc} locale={locale} />}
      </div>

      {formOpen && canManage && (
        <ScheduleForm teachers={teachers} initial={formTeacher} locale={locale} onClose={() => { setFormOpen(false); setFormTeacher(null); }} />
      )}

      {/* Holat tanlash menyusi (jurnal katagi uchun) */}
      {menu && createPortal(
        <div
          ref={popRef}
          style={{ left: menu.x, top: menu.y, transform: `translate(-50%, ${menu.up ? "-100%" : "0"})` }}
          className="fixed z-[90] w-max max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-1.5 px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{menu.name}</span> · {shortDate(menu.date, locale)}
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_ORDER.map((x) => {
              const off = menu.future && x !== "EXCUSED";
              return (
                <button key={x} type="button" disabled={off} onClick={() => setMark(menu.teacherId, menu.date, x)}
                  className={cn("whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold", STATUS_STYLE[x], menuStatus === x && "ring-2 ring-slate-400 ring-offset-1 dark:ring-offset-slate-900", off && "cursor-not-allowed opacity-30")}>
                  {statusLabel(x, locale)}
                </button>
              );
            })}
            {menuStatus && (
              <button type="button" onClick={() => setMark(menu.teacherId, menu.date, null)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={tr(locale, { uz: "Belgini olib tashlash", ru: "Снять отметку", en: "Clear", de: "Entfernen" })}>✕</button>
            )}
          </div>
          {menu.future && <p className="mt-1.5 px-1 text-[10.5px] text-slate-400">{errText("future")}</p>}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ───────── Shartli belgilar ───────── */
function Legend({ locale }: { locale: Locale }) {
  const box = "grid h-4 w-4 shrink-0 place-items-center rounded text-[9px] font-bold";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      {STATUS_ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1"><span className={cn(box, STATUS_STYLE[s])}>{statusGlyph(s, locale)}</span>{statusLabel(s, locale)}</span>
      ))}
      <span className="flex items-center gap-1"><span className={cn(box, "border border-slate-300 dark:border-slate-600")} />{tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht markiert" })}</span>
      <span className="flex items-center gap-1"><span className={cn(box, "border border-dashed border-slate-300 dark:border-slate-600")} />{tr(locale, { uz: "Kelajak", ru: "Будущее", en: "Upcoming", de: "Zukünftig" })}</span>
      <span className="flex items-center gap-1"><span className={cn(box, "bg-slate-100 dark:bg-slate-800")} />{tr(locale, { uz: "Ish kuni emas", ru: "Нерабочий день", en: "Day off", de: "Kein Arbeitstag" })}</span>
    </div>
  );
}

/* ───────── 1) Oylik jurnal: ustozlar × oy sanalari ───────── */
function JournalGrid({ teachers, days, marks, calc, markable, onCell, onDay, menu, locale }: {
  teachers: VTeacher[]; days: Day[]; marks: Map<string, TStatus>; calc: (t: VTeacher) => Totals;
  markable: (t: VTeacher, key: string, wd: number) => boolean;
  onCell: (e: React.MouseEvent<HTMLButtonElement>, t: VTeacher, d: Day) => void; onDay: (key: string) => void;
  menu: Menu | null; locale: Locale;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Joriy oyda bugungi ustun ko'rinadigan joyga aylantiriladi
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const el = box.querySelector<HTMLElement>("[data-today='1']");
    box.scrollLeft = el ? Math.max(0, el.offsetLeft - 320) : 0;
  }, [days]);

  const notMarked = tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht markiert" });
  const upcoming = tr(locale, { uz: "Kelajak", ru: "Будущее", en: "Upcoming", de: "Zukünftig" });
  const dayOff = tr(locale, { uz: "Ish kuni emas", ru: "Нерабочий день", en: "Day off", de: "Kein Arbeitstag" });
  const hoursUnit = tr(locale, { uz: "soat", ru: "ч", en: "h", de: "Std." });
  const th = "px-2 py-2 text-center text-[11px] font-semibold";

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            <th className="sticky left-0 z-20 min-w-[160px] bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 sm:min-w-[210px] dark:bg-slate-800">{tr(locale, { uz: "Ustozlar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" })}</th>
            {days.map((d) => (
              <th key={d.key} data-today={d.today ? "1" : undefined} className={cn("px-0.5 py-1.5 text-center", d.weekend && !d.today && "bg-slate-100/70 dark:bg-slate-800")}>
                <button type="button" onClick={() => onDay(d.key)} title={tr(locale, { uz: "Kunlik ko'rinish", ru: "Дневной вид", en: "Daily view", de: "Tagesansicht" })}
                  className={cn("mx-auto flex w-8 flex-col items-center rounded-md py-0.5 leading-tight transition", d.today ? "bg-brand-600 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700")}>
                  <span className={cn("text-[12px] font-semibold", !d.today && (d.future ? "text-slate-400" : "text-slate-700 dark:text-slate-200"))}>{d.d}</span>
                  <span className={cn("text-[10px]", d.today ? "text-white/80" : d.weekend ? "text-rose-400" : "text-slate-400")}>{WD[locale][d.wd]}</span>
                </button>
              </th>
            ))}
            <th className={cn(th, "border-l border-slate-200 text-slate-500 dark:border-slate-700")} title={tr(locale, { uz: "Oydagi rejadagi ish kunlari", ru: "Плановые рабочие дни в месяце", en: "Planned work days this month", de: "Geplante Arbeitstage im Monat" })}>{tr(locale, { uz: "Ish kuni", ru: "Раб. дни", en: "Work days", de: "Arbeitstage" })}</th>
            <th className={cn(th, "text-emerald-600")}>{tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present", de: "Anwesend" })}</th>
            <th className={cn(th, "text-amber-600")}>{tr(locale, { uz: "Kechikdi", ru: "Опоздал", en: "Late", de: "Verspätet" })}</th>
            <th className={cn(th, "text-rose-500")}>{tr(locale, { uz: "Kelmadi", ru: "Не пришёл", en: "Absent", de: "Abwesend" })}</th>
            <th className={cn(th, "text-sky-600")}>{tr(locale, { uz: "Sababli", ru: "Уваж.", en: "Excused", de: "Entsch." })}</th>
            <th className={cn(th, "text-slate-500")} title={tr(locale, { uz: "Kelgan kunlardagi ish vaqti: ish jadvali soatlari, bo'lmasa guruh dars vaqtlari", ru: "Рабочее время в дни присутствия: по графику работы, иначе по времени занятий групп", en: "Hours on attended days: work schedule hours, otherwise group lesson times", de: "Stunden an Anwesenheitstagen: laut Arbeitsplan, sonst nach Unterrichtszeiten" })}>
              {tr(locale, { uz: "Soat", ru: "Часы", en: "Hours", de: "Stunden" })}
            </th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t, i) => {
            const c = calc(t);
            const wds = effWeekdays(t);
            return (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-[11px] text-slate-400">{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="max-w-[115px] truncate text-[13px] font-medium text-slate-800 sm:max-w-[170px] dark:text-slate-100" title={t.name}>{t.name}</div>
                      <div className="text-[10.5px] text-slate-400">{wdName(wds, locale)}</div>
                    </div>
                  </div>
                </td>
                {days.map((d) => {
                  const k = `${t.id}|${d.key}`;
                  const st = marks.get(k);
                  const working = wds.includes(d.wd);
                  const can = markable(t, d.key, d.wd);
                  const open = menu?.teacherId === t.id && menu.date === d.key;
                  const min = st && isCame(st) ? dayMinutes(t, d.key, d.wd) : 0;
                  const what = st ? statusLabel(st, locale) : !working ? dayOff : d.future ? upcoming : notMarked;
                  return (
                    <td key={d.key} className={cn("px-0.5 py-1 text-center", d.today ? "bg-brand-50/60 dark:bg-brand-500/10" : d.weekend && "bg-slate-50/80 dark:bg-slate-800/30")}>
                      <button
                        type="button"
                        data-tcell=""
                        aria-disabled={!can}
                        onClick={(e) => onCell(e, t, d)}
                        title={`${shortDate(d.key, locale)} — ${what}${min ? ` (${fmtHours(min)} ${hoursUnit})` : ""}`}
                        className={cn("mx-auto grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold transition",
                          st ? STATUS_STYLE[st]
                            : !working ? "bg-slate-100 dark:bg-slate-800/70"
                            : d.future ? "border border-dashed border-slate-200 dark:border-slate-700"
                            : "border border-slate-300 dark:border-slate-600",
                          can ? (st ? "hover:opacity-80" : "hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10") : "cursor-default",
                          open && "ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-slate-900")}
                      >
                        {st ? statusGlyph(st, locale) : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:text-slate-300">{c.workDays}</td>
                <td className="px-2 py-1 text-center text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {c.keldi}
                  {c.extra > 0 && <span className="ml-0.5 text-[10px] font-semibold text-slate-400" title={tr(locale, { uz: "Qo'shimcha: ish kuni bo'lmagan kunda kelgan", ru: "Дополнительно: приходил в нерабочий день", en: "Extra: came on a non-working day", de: "Zusätzlich: an einem freien Tag anwesend" })}>+{c.extra}</span>}
                </td>
                <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">{c.late}</td>
                <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-rose-500">{c.absent}</td>
                <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">{c.excused}</td>
                <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{c.minutes ? fmtHours(c.minutes) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── Kunlik ko'rinish: tanlangan sana bo'yicha belgilash ───────── */
function DayView({ teachers, date, wd, future, marks, canMark, markable, onSet, locale }: {
  teachers: VTeacher[]; date: string; wd: number; future: boolean; marks: Map<string, TStatus>; canMark: boolean;
  markable: (t: VTeacher, key: string, wd: number) => boolean; onSet: (teacherId: string, date: string, status: TStatus | null) => void; locale: Locale;
}) {
  // Kun xulosasi: ish kuni bo'lgan ustozlar bo'yicha
  const sum = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, none: 0 };
  for (const t of teachers) {
    const st = marks.get(`${t.id}|${date}`);
    if (st) sum[st]++;
    else if (effWeekdays(t).includes(wd)) sum.none++;
  }
  const th = "px-3 py-2.5";

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 dark:border-slate-700">
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_STYLE[s])} />
            <span className="text-slate-500 dark:text-slate-400">{statusLabel(s, locale)}</span>
            <b className="tabular-nums text-slate-800 dark:text-slate-100">{sum[s]}</b>
          </span>
        ))}
        <span className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 dark:border-slate-600">
          <span className="text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht markiert" })}</span>
          <b className="tabular-nums text-slate-800 dark:text-slate-100">{sum.none}</b>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className={cn(th, "w-10")}>#</th>
              <th className={th}>{tr(locale, { uz: "Ustoz", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th>
              <th className={th}>{tr(locale, { uz: "Ish vaqti", ru: "Рабочее время", en: "Work time", de: "Arbeitszeit" })}</th>
              <th className={cn(th, "text-center")}>{tr(locale, { uz: "Soat", ru: "Часы", en: "Hours", de: "Stunden" })}</th>
              <th className={th}>{tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {teachers.map((t, i) => {
              const working = effWeekdays(t).includes(wd);
              const st = marks.get(`${t.id}|${date}`);
              const can = markable(t, date, wd);
              const sc = t.schedule;
              const plan = spanMin(sc?.startTime, sc?.endTime)
                ? `${sc!.startTime}–${sc!.endTime}`
                : slotsOn(t, date, wd).map((s) => `${s.start}–${s.end}`).join(", ");
              const min = dayMinutes(t, date, wd);
              return (
                <tr key={t.id} className={cn("hover:bg-slate-50/60 dark:hover:bg-slate-800/40", !working && !st && "opacity-60")}>
                  <td className="px-3 py-2 text-[11px] text-slate-400">{i + 1}.</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{t.name}</span>
                    {!working && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tr(locale, { uz: "Ish kuni emas", ru: "Нерабочий день", en: "Day off", de: "Kein Arbeitstag" })}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">{working && plan ? plan : "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-300">{working && min ? fmtHours(min) : "—"}</td>
                  <td className="px-3 py-2">
                    {canMark && can ? (
                      <div className="flex flex-wrap gap-1">
                        {STATUS_ORDER.map((x) => {
                          const off = future && x !== "EXCUSED";
                          return (
                            <button key={x} type="button" disabled={off} onClick={() => onSet(t.id, date, x)}
                              className={cn("whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition",
                                st === x ? STATUS_STYLE[x] : "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                                off && "cursor-not-allowed opacity-40")}>
                              {statusLabel(x, locale)}
                            </button>
                          );
                        })}
                      </div>
                    ) : st ? (
                      <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[st])}>{statusLabel(st, locale)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {!working ? "—" : future ? tr(locale, { uz: "Kelajak", ru: "Будущее", en: "Upcoming", de: "Zukünftig" }) : tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht markiert" })}
                      </span>
                    )}
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

/* ───────── 2) Ish jadvali ───────── */
function JadvalTab({ teachers, canManage, locale, onAdd, onEdit }: {
  teachers: VTeacher[]; canManage: boolean; locale: Locale; onAdd: () => void; onEdit: (t: VTeacher) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Ish jadvali yoki guruhi bor barcha o'qituvchi (guruh kunlari avtomatik ish kuni)
  const list = teachers.filter((t) => t.schedule || t.groupWeekdays.length);
  const del = async (teacherId: string) => { if (await confirmDelete(tr(locale, { uz: "Ish jadvalini o'chirasizmi?", ru: "Удалить график работы?", en: "Delete work schedule?", de: "Arbeitsplan löschen?" }))) start(async () => { await deleteTeacherSchedule(teacherId); router.refresh(); }); };

  return (
    <div>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <button onClick={onAdd} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить новый", en: "Add new", de: "Neu hinzufügen" })}</button>
        </div>
      )}
      <div className={cn("overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800", pending && "opacity-70")}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days", de: "Arbeitstage" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish boshlanish vaqti", ru: "Время начала работы", en: "Work start time", de: "Arbeitsbeginn" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Ish tugash vaqti", ru: "Время окончания работы", en: "Work end time", de: "Arbeitsende" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Oylik maoshi", ru: "Месячная зарплата", en: "Monthly salary", de: "Monatsgehalt" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Ish faoliyatining boshlanishi", ru: "Начало трудовой деятельности", en: "Employment start", de: "Beschäftigungsbeginn" })}</th>
              <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
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
                  {!sc && effWeekdays(t).length > 0 && <span className="ml-1.5 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">{tr(locale, { uz: "guruhdan", ru: "из групп", en: "from groups", de: "aus Gruppen" })}</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{sc?.startTime ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{sc?.endTime ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(sc?.monthlySalary ?? t.fiksa, locale)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{sc?.startedAt || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage && <button onClick={() => onEdit(t)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{sc ? tr(locale, { uz: "Tahrir", ru: "Изменить", en: "Edit", de: "Bearbeiten" }) : tr(locale, { uz: "Sozlash", ru: "Настроить", en: "Set up", de: "Einrichten" })}</button>}
                    {canManage && sc && <button onClick={() => del(t.id)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900">{tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}</button>}
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
            <th className="px-4 py-3">{tr(locale, { uz: "Ustozlar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Belgilangan maosh", ru: "Установленная зарплата", en: "Set salary", de: "Festgelegtes Gehalt" })}</th><th className="px-4 py-3 text-center">{tr(locale, { uz: "To'liq ish kuni", ru: "Полный рабочий день", en: "Full work days", de: "Volle Arbeitstage" })}</th>
            <th className="px-4 py-3 text-center">{tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present", de: "Anwesend" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Asosiy maosh", ru: "Основная зарплата", en: "Base salary", de: "Grundgehalt" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Qo'shimcha tushum", ru: "Дополнительный доход", en: "Extra income", de: "Zusätzliches Einkommen" })}</th><th className="px-4 py-3 text-right">{tr(locale, { uz: "Jami maosh", ru: "Итого зарплата", en: "Total salary", de: "Gesamtgehalt" })}</th>
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
      <form ref={formRef} action={action} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full drawer-panel flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{initial?.schedule ? tr(locale, { uz: "Ish jadvalini tahrirlash", ru: "Редактировать график работы", en: "Edit work schedule", de: "Arbeitsplan bearbeiten" }) : tr(locale, { uz: "Yangi ish jadvali", ru: "Новый график работы", en: "New work schedule", de: "Neuer Arbeitsplan" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={lbl}>{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })} <span className="text-rose-500">*</span></label>
            <select name="teacherId" required defaultValue={initial?.id ?? ""} disabled={!!initial} onChange={(e) => pickTeacher(e.target.value)} className={inp}>
              <option value="" disabled>{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days", de: "Arbeitstage" })}</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_VALUES.map((v) => (
                <button key={v} type="button" onClick={() => toggle(v)} className={cn("h-9 w-11 rounded-lg border text-sm font-semibold transition", days.includes(v) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300")}>{WD[locale][v]}</button>
              ))}
            </div>
            <input type="hidden" name="weekdays" value={days.join(",")} />
            <p className="mt-1 text-[11px] text-slate-400">{tr(locale, { uz: "Guruh dars kunlaridan avtomatik to'ldiriladi (kerak bo'lsa o'zgartiring)", ru: "Автозаполняется по дням занятий групп (можно изменить)", en: "Auto-filled from group lesson days (editable)", de: "Wird automatisch aus den Gruppentagen ausgefüllt (bearbeitbar)" })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Ish boshlanish vaqti", ru: "Время начала работы", en: "Work start time", de: "Arbeitsbeginn" })}</label><input name="startTime" type="time" defaultValue={initial?.schedule?.startTime ?? ""} className={inp} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Ish tugash vaqti", ru: "Время окончания работы", en: "Work end time", de: "Arbeitsende" })}</label><input name="endTime" type="time" defaultValue={initial?.schedule?.endTime ?? ""} className={inp} /></div>
          </div>
          <div><label className={lbl}>{tr(locale, { uz: "Oylik maoshi (so'm)", ru: "Месячная зарплата (сум)", en: "Monthly salary (so'm)", de: "Monatsgehalt (UZS)" })}</label><input name="monthlySalary" type="number" min="0" defaultValue={initial?.schedule?.monthlySalary ?? initial?.fiksa ?? 0} className={inp} /></div>
          <div><label className={lbl}>{tr(locale, { uz: "Ish faoliyatining boshlanishi", ru: "Начало трудовой деятельности", en: "Employment start", de: "Beschäftigungsbeginn" })}</label><DateInput name="startedAt" defaultValue={initial?.schedule?.startedAtIso ?? ""} className={inp} /></div>
          {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "Information is incomplete.", de: "Angaben sind unvollständig." })}</p>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>, document.body);
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("-mb-px whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium transition", active ? "border-brand-600 text-brand-600 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>{children}</button>;
}
function Empty({ locale }: { locale: Locale }) {
  return <div className="py-12 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty", de: "Leer" })}</div>;
}
