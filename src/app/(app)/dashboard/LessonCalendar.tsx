"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";

export interface CalLesson {
  id: string;
  groupId: string;
  day: number; // 0=Yakshanba ... 6=Shanba
  startMin: number;
  endMin: number;
  group: string;
  teacher: string | null;
  room: string | null;
  course: string;
  color?: string | null; // guruh rangi (hex)
  startISO?: string | null; // guruh boshlanish sanasi "yyyy-mm-dd"
  endISO?: string | null; // guruh tugash sanasi "yyyy-mm-dd"
  students?: number; // guruhdagi o'quvchilar soni
  capacity?: number; // guruh sig'imi
  isPast: boolean;
}

interface Props {
  locale: Locale;
  lessons: CalLesson[];
  teachers: string[];
  groups: string[];
  rooms: string[];
  courses: string[];
  todayIndex: number;
  todayISO?: string; // server bugungi sana "yyyy-mm-dd" (hafta navigatsiyasi uchun)
  weekNav?: boolean; // hafta bo'ylab o'tish (oldingi/keyingi hafta) yoqilsinmi
  defaultView?: "grid" | "list";
  /** Ro'yxat ko'rinishida qatorlar nima bo'yicha: xona (asosiy) / o'qituvchi / guruh */
  defaultGroupMode?: "room" | "teacher" | "group"; // "list" = xona×vaqt gorizontal matritsa (Dars jadvali sahifasi shundan boshlanadi)
}

const DAY_LABELS: Record<Locale, string[]> = {
  uz: ["Yak", "Du", "Se", "Chor", "Pa", "Ju", "Sha"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const T: Record<Locale, Record<string, string>> = {
  uz: {
    title: "Dars jadvali", teacher: "O'qituvchi", group: "Guruh", room: "Xona", course: "Kurs", status: "Holati",
    all: "Barchasi", filter: "Filtr", export: "Eksport", upcoming: "Kelgusi", past: "O'tgan", empty: "Bu kunda dars yo'q",
    byRoom: "Xona bo'yicha", byTeacher: "O'qituvchi bo'yicha", byGroup: "Guruh bo'yicha", gridV: "Panjara", listV: "Ro'yxat", settings: "Sozlamalar",
    timeRange: "Vaqt oralig'i", fs: "Butun ekran", cfgTitle: "Jadval ko'rinishi sozlamalari",
    cfgSub: "Har bir qator uchun maydon tanlang", save: "Saqlash",
    s1: "1-sarlavha", s2: "2-sarlavha", s3: "3-sarlavha", s4: "1-qator", s5: "2-qator", s6: "3-qator", s7: "Pastki qator",
    fNone: "—", fTime: "Dars vaqti", fCourse: "Kurs nomi", fTeacher: "O'qituvchi", fRoom: "Xona", fGroup: "Guruh nomi", fDay: "Dars kuni",
  },
  ru: {
    title: "Расписание", teacher: "Преподаватель", group: "Группа", room: "Кабинет", course: "Курс", status: "Статус",
    all: "Все", filter: "Фильтр", export: "Экспорт", upcoming: "Предстоящие", past: "Прошедшие", empty: "Нет уроков в этот день",
    byRoom: "По кабинетам", byTeacher: "По преподавателям", byGroup: "По группам", gridV: "Сетка", listV: "Список", settings: "Настройки",
    timeRange: "Диапазон времени", fs: "Полный экран", cfgTitle: "Настройки вида расписания",
    cfgSub: "Выберите поле для каждой строки", save: "Сохранить",
    s1: "1-й заголовок", s2: "2-й заголовок", s3: "3-й заголовок", s4: "1-я строка", s5: "2-я строка", s6: "3-я строка", s7: "Нижняя строка",
    fNone: "—", fTime: "Время урока", fCourse: "Название курса", fTeacher: "Преподаватель", fRoom: "Кабинет", fGroup: "Название группы", fDay: "День",
  },
  en: {
    title: "Schedule", teacher: "Teacher", group: "Group", room: "Room", course: "Course", status: "Status",
    all: "All", filter: "Filter", export: "Export", upcoming: "Upcoming", past: "Past", empty: "No lessons this day",
    byRoom: "By room", byTeacher: "By teacher", byGroup: "By group", gridV: "Grid", listV: "List", settings: "Settings",
    timeRange: "Time range", fs: "Fullscreen", cfgTitle: "Schedule view settings",
    cfgSub: "Choose a field for each row", save: "Save",
    s1: "Title 1", s2: "Title 2", s3: "Title 3", s4: "Row 1", s5: "Row 2", s6: "Row 3", s7: "Bottom row",
    fNone: "—", fTime: "Lesson time", fCourse: "Course name", fTeacher: "Teacher", fRoom: "Room", fGroup: "Group name", fDay: "Day",
  },
};

const ROW = 40;
const ROW_H = 104; // xona×vaqt matritsasidagi qator balandligi (blokka 4 qator sig'adi)
const RANGES = [
  { key: "08:00 – 22:00", from: 8, to: 22 },
  { key: "06:00 – 23:00", from: 6, to: 23 },
  { key: "00:00 – 24:00", from: 0, to: 24 },
];

// Karta maydonlari (Sozlamalar panelidagi variantlar)
const FIELD_OPTS = ["", "time", "course", "teacher", "room", "group", "day"] as const;
type SlotKey = "t1" | "t2" | "t3" | "r1" | "r2" | "r3" | "rb";
const SLOTS: { key: SlotKey; labelKey: string }[] = [
  { key: "t1", labelKey: "s1" }, { key: "t2", labelKey: "s2" }, { key: "t3", labelKey: "s3" },
  { key: "r1", labelKey: "s4" }, { key: "r2", labelKey: "s5" }, { key: "r3", labelKey: "s6" }, { key: "rb", labelKey: "s7" },
];
const DEFAULT_CFG: Record<SlotKey, string> = { t1: "time", t2: "course", t3: "teacher", r1: "room", r2: "day", r3: "group", rb: "" };

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// "2026-07-01" → "1 iyul" (blokdagi davr yozuvi uchun; deterministik, Intl'siz)
const MONTHS_SHORT: Record<Locale, string[]> = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"],
  ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
};
function shortDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS_SHORT[locale][m - 1] ?? ""}`;
}

// Guruh rangiga mos blok uslubi (chap accent + tanlangan rangdagi parda). Rang bo'lmasa undefined.
function blockStyle(color: string | null | undefined, isPast: boolean): React.CSSProperties | undefined {
  if (!color) return undefined;
  return {
    borderLeftColor: isPast ? color + "99" : color, // o'tgan dars — biroz xira
    backgroundColor: color + (isPast ? "1f" : "40"), // parda aniq tanlangan rangda (o'tgan 12%, kelgusi 25%)
  };
}

// Fon rangiga mos o'qiladigan matn rangi — to'q va oq variantdan KONTRASTI YUQORIsi tanlanadi
// (WCAG nisbiy yorqinligi bo'yicha). Qat'iy chegara ishlamaydi: yashil/sariq/feruza kabi
// "o'rtacha" ranglarda oq matn yo'qolib ketardi. Foydalanuvchi istalgan rang tanlasa ham ishlaydi.
const TXT_DARK = "#1e293b";
const TXT_LIGHT = "#ffffff";
function relLum(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [relLum(a), relLum(b)];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function readableOn(hex: string): string {
  return contrast(hex, TXT_DARK) >= contrast(hex, TXT_LIGHT) ? TXT_DARK : TXT_LIGHT;
}

/** Rangni oq bilan aralashtirib ochroq qilish (0..1). */
function lighten(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const parts = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * amount);
  });
  return "#" + parts.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Xona×vaqt matritsasi uchun TO'LIQ bo'yalgan blok (Modme uslubi).
 * Guruh rangi 25% oq bilan aralashtiriladi: pastel ko'rinish + matn kontrasti AA (eng past 4.98).
 * Toza 500-darajali ranglarda matn kontrasti 3.3 gacha tushib, o'qilmay qolardi.
 */
function solidBlockStyle(color: string | null | undefined, isPast: boolean): React.CSSProperties {
  const bg = lighten(color || "#64748b", 0.25);
  return {
    backgroundColor: bg,
    color: readableOn(bg),
    opacity: isPast ? 0.55 : 1, // o'tgan dars — xiraroq
  };
}

export default function LessonCalendar(p: Props) {
  const t = T[p.locale] ?? T.uz;
  const days = DAY_LABELS[p.locale] ?? DAY_LABELS.uz;

  const [day, setDay] = useState(p.todayIndex);
  const [weekOffset, setWeekOffset] = useState(0); // 0=joriy hafta, -1=oldingi, +1=keyingi
  const [showFilter, setShowFilter] = useState(true);
  const [fTeacher, setFTeacher] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fRoom, setFRoom] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fStatus, setFStatus] = useState("");

  // Qatorlar nima bo'yicha guruhlanadi: xona / o'qituvchi / guruh
  const [groupMode, setGroupMode] = useState<"room" | "teacher" | "group">(p.defaultGroupMode ?? "room");
  // Dars qaysi qatorga tushishi (tanlangan rejimga qarab)
  const rowKeyOf = (l: CalLesson) => (groupMode === "room" ? l.room : groupMode === "teacher" ? l.teacher : l.group);
  const [viewType, setViewType] = useState<"grid" | "list">(p.defaultView ?? "grid");
  const [rangeIdx, setRangeIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [cfg, setCfg] = useState<Record<SlotKey, string>>(DEFAULT_CFG);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    try {
      const saved = localStorage.getItem("gl-cal-card");
      if (saved) setCfg({ ...DEFAULT_CFG, ...JSON.parse(saved) });
    } catch {}
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen().catch(() => {});
  }

  function saveCfg() {
    try { localStorage.setItem("gl-cal-card", JSON.stringify(cfg)); } catch {}
    setShowSettings(false);
  }

  const range = RANGES[rangeIdx];
  const slots = useMemo(() => {
    const arr: { min: number; label: string }[] = [];
    for (let m = range.from * 60; m < range.to * 60; m += 30) arr.push({ min: m, label: `${hhmm(m)} - ${hhmm(m + 30)}` });
    return arr;
  }, [range.from, range.to]);

  // Hafta sanalari (yakshanbadan boshlab, weekOffset bo'yicha suriladi)
  const todayDate = useMemo(() => (p.todayISO ? new Date(p.todayISO + "T00:00:00") : new Date()), [p.todayISO]);
  const weekDates = useMemo(() => {
    const base = new Date(todayDate);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - todayDate.getDay() + weekOffset * 7); // ko'rilayotgan haftaning yakshanbasi
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
  }, [todayDate, weekOffset]);
  const selDate = weekDates[day];
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  // Ko'rilayotgan kun (sana) uchun dars o'tganmi
  const pastAt = (endMin: number) => selDate.getTime() + endMin * 60000 < Date.now();
  // Guruh shu sanaga qadar boshlanganmi (boshlanish sanasidan oldingi haftalarda ko'rsatilmaydi)
  const startedBy = (l: CalLesson) => !p.weekNav || !l.startISO || new Date(l.startISO + "T00:00:00").getTime() <= selDate.getTime();

  const dayLessons = useMemo(() => {
    return p.lessons
      .filter((l) => {
        if (l.day !== day) return false;
        if (fTeacher && l.teacher !== fTeacher) return false;
        if (fGroup && l.group !== fGroup) return false;
        if (fRoom && l.room !== fRoom) return false;
        if (fCourse && l.course !== fCourse) return false;
        if (!startedBy(l)) return false;
        if (fStatus) {
          const past = p.weekNav ? pastAt(l.endMin) : l.isPast;
          return fStatus === "past" ? past : !past;
        }
        return true;
      })
      .sort((a, b) => a.startMin - b.startMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lessons, day, weekOffset, p.weekNav, fTeacher, fGroup, fRoom, fCourse, fStatus]);

  function fv(l: CalLesson, key: string): string | null {
    switch (key) {
      case "time": return `${hhmm(l.startMin)}–${hhmm(l.endMin)}`;
      case "course": return l.course;
      case "teacher": return l.teacher;
      case "room": return l.room;
      case "group": return l.group;
      case "day": return days[l.day];
      default: return null;
    }
  }
  function lines(l: CalLesson) {
    const title = fv(l, cfg.t1) || l.group;
    const sub = [cfg.t2, cfg.t3, cfg.r1, cfg.r2, cfg.r3, cfg.rb].map((k) => fv(l, k)).filter(Boolean).join(" · ");
    return { title, sub };
  }
  function fieldLabel(key: string) {
    return ({ "": t.fNone, time: t.fTime, course: t.fCourse, teacher: t.fTeacher, room: t.fRoom, group: t.fGroup, day: t.fDay } as Record<string, string>)[key];
  }

  // Ro'yxat (matritsa) ko'rinishi uchun qatorlar: xona yoki o'qituvchi
  const rowNames = useMemo(() => {
    const base = groupMode === "room" ? p.rooms : groupMode === "teacher" ? p.teachers : p.groups;
    const set = new Set<string>(base.filter(Boolean));
    dayLessons.forEach((l) => set.add(rowKeyOf(l) || "—"));
    return [...set];
  }, [groupMode, dayLessons, p.rooms, p.teachers, p.groups]);
  const lessonsForRow = (name: string) =>
    dayLessons.filter((l) => (rowKeyOf(l) || "—") === name);

  function exportCsv() {
    const rows = [[
      tr(p.locale, { uz: "Kun", ru: "День", en: "Day" }),
      tr(p.locale, { uz: "Vaqt", ru: "Время", en: "Time" }),
      tr(p.locale, { uz: "Guruh", ru: "Группа", en: "Group" }),
      tr(p.locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }),
      tr(p.locale, { uz: "Xona", ru: "Кабинет", en: "Room" }),
      tr(p.locale, { uz: "Kurs", ru: "Курс", en: "Course" }),
    ]];
    dayLessons.forEach((l) => rows.push([days[l.day], `${hhmm(l.startMin)}-${hhmm(l.endMin)}`, l.group, l.teacher ?? "", l.room ?? "", l.course]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "dars-jadvali.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const sel = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div ref={rootRef} className="relative rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      {/* Sarlavha + Filtr/Eksport */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="calendar" className="h-4 w-4 text-brand-500" /> {t.title}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilter((v) => !v)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition", showFilter ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300")}>
            <Icon name="filter" className="h-4 w-4" /> {t.filter}
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <Icon name="download" className="h-4 w-4" /> {t.export}
          </button>
        </div>
      </div>

      {/* Filtrlar */}
      {showFilter && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          <select value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} className={sel}><option value="">{t.teacher}: {t.all}</option>{p.teachers.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} className={sel}><option value="">{t.group}: {t.all}</option>{p.groups.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={fRoom} onChange={(e) => setFRoom(e.target.value)} className={sel}><option value="">{t.room}: {t.all}</option>{p.rooms.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={fCourse} onChange={(e) => setFCourse(e.target.value)} className={sel}><option value="">{t.course}: {t.all}</option>{p.courses.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}><option value="">{t.status}: {t.all}</option><option value="upcoming">{t.upcoming}</option><option value="past">{t.past}</option></select>
        </div>
      )}

      {/* Hafta navigatori (yoqilgan bo'lsa) — oldingi/keyingi hafta */}
      {p.weekNav && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 pt-3 pb-1 dark:border-slate-800">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300" aria-label={tr(p.locale, { uz: "Oldingi hafta", ru: "Прошлая неделя", en: "Previous week" })}>‹</button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{dm(weekDates[0])} – {dm(weekDates[6])}.{weekDates[6].getFullYear()}</span>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300" aria-label={tr(p.locale, { uz: "Keyingi hafta", ru: "Следующая неделя", en: "Next week" })}>›</button>
          {weekOffset !== 0 && (
            <button onClick={() => { setWeekOffset(0); setDay(p.todayIndex); }} className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">{tr(p.locale, { uz: "Bugun", ru: "Сегодня", en: "Today" })}</button>
          )}
        </div>
      )}

      {/* Kun tablari + ko'rinish tugmalari */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {days.map((d, i) => {
            const isToday = p.weekNav ? weekOffset === 0 && i === p.todayIndex : i === p.todayIndex;
            return (
              <button key={i} onClick={() => setDay(i)} className={cn("min-w-[52px] rounded-lg px-3 py-1.5 text-center text-sm font-medium leading-tight transition", i === day ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300", isToday && i !== day && "ring-1 ring-brand-300")}>
                <span className="block">{d}</span>
                {p.weekNav && <span className={cn("block text-[10px]", i === day ? "text-white/85" : "text-slate-400")}>{dm(weekDates[i])}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            <TBtn label={t.byRoom} active={groupMode === "room"} onClick={() => setGroupMode("room")}><Icon name="building" className="h-4 w-4" /></TBtn>
            <TBtn label={t.byTeacher} active={groupMode === "teacher"} onClick={() => setGroupMode("teacher")}><Icon name="user" className="h-4 w-4" /></TBtn>
            <TBtn label={t.byGroup} active={groupMode === "group"} onClick={() => setGroupMode("group")}><Icon name="layers" className="h-4 w-4" /></TBtn>
          </div>
          <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            <TBtn label={t.gridV} active={viewType === "grid"} onClick={() => setViewType("grid")}><Icon name="grid" className="h-4 w-4" /></TBtn>
            <TBtn label={t.listV} active={viewType === "list"} onClick={() => setViewType("list")}><Icon name="listView" className="h-4 w-4" /></TBtn>
          </div>
          <TBtn label={t.settings} solo active={showSettings} onClick={() => setShowSettings((v) => !v)}><Icon name="settings" className="h-4 w-4" /></TBtn>
          <TBtn label={t.fs} solo onClick={toggleFs}><Icon name="expand" className="h-4 w-4" /></TBtn>
        </div>
      </div>

      {/* Ko'rinish: Panjara */}
      {viewType === "grid" ? (
        <div className={cn("overflow-y-auto px-5 pb-5", isFs ? "max-h-[calc(100vh-220px)]" : "max-h-[520px]")}>
          <div className="flex">
            <div className="w-[110px] shrink-0">
              {slots.map((s) => (<div key={s.min} className="flex items-center justify-center border-b border-r border-slate-100 text-xs text-slate-400" style={{ height: ROW }}>{s.label}</div>))}
            </div>
            <div className="relative flex-1" style={{ height: slots.length * ROW }}>
              {slots.map((s, i) => (<div key={s.min} className="absolute left-0 right-0 border-b border-slate-100" style={{ top: i * ROW, height: ROW }} />))}
              {dayLessons.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{t.empty}</div>}
              {dayLessons.map((l) => {
                const top = ((Math.max(range.from * 60, l.startMin) - range.from * 60) / 30) * ROW;
                const height = Math.max(ROW - 4, ((Math.min(range.to * 60, l.endMin) - l.startMin) / 30) * ROW - 4);
                const { title, sub } = lines(l);
                const past = p.weekNav ? pastAt(l.endMin) : l.isPast;
                const cst = blockStyle(l.color, past);
                return (
                  <Link key={l.id} href={`/groups/${l.groupId}`} className={cn("absolute left-2 right-2 overflow-hidden rounded-lg border-l-4 p-2 text-xs shadow-sm transition hover:shadow-md", !cst && (past ? "border-slate-400 bg-slate-50 dark:bg-slate-800" : "border-brand-500 bg-brand-50 dark:bg-brand-950/40"))} style={{ top: top + 2, height, ...cst }}>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
                    {sub && <div className="truncate text-slate-500 dark:text-slate-300">{sub}</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("overflow-auto", isFs ? "max-h-[calc(100vh-220px)]" : "max-h-[560px]")}>
          {rowNames.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">{t.empty}</div>
          ) : (
            <div className="min-w-max pb-2">
              {/* Sarlavha: vaqt ustunlari (gorizontal) */}
              <div className="sticky top-0 z-20 flex bg-slate-50/95 backdrop-blur dark:bg-slate-800/90">
                <div className="sticky left-0 z-30 flex w-[150px] shrink-0 items-center border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/90">
                  {groupMode === "room" ? t.room : groupMode === "teacher" ? t.teacher : t.group}
                </div>
                {slots.map((s) => (
                  <div key={s.min} className="flex w-[128px] shrink-0 items-center justify-center border-b border-r border-slate-100 px-1 py-2.5 text-[11px] text-slate-500 dark:border-slate-700/60">{s.label}</div>
                ))}
              </div>
              {/* Qatorlar: xona/o'qituvchi + darslar */}
              {rowNames.map((name) => (
                <div key={name} className="flex">
                  <div className="sticky left-0 z-10 flex w-[150px] shrink-0 items-center border-b border-r border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900">
                    <span className="truncate">{name}</span>
                  </div>
                  <div className="relative border-b border-slate-100 dark:border-slate-800" style={{ width: slots.length * 128, height: ROW_H }}>
                    {slots.map((s, i) => (<div key={s.min} className="absolute top-0 h-full border-r border-slate-100 dark:border-slate-800/60" style={{ left: i * 128, width: 128 }} />))}
                    {lessonsForRow(name).map((l) => {
                      const left = ((Math.max(range.from * 60, l.startMin) - range.from * 60) / 30) * 128;
                      const width = Math.max(60, ((Math.min(range.to * 60, l.endMin) - l.startMin) / 30) * 128 - 4);
                      const past = p.weekNav ? pastAt(l.endMin) : l.isPast;
                      const cst = solidBlockStyle(l.color, past);
                      const period = [l.startISO, l.endISO].filter(Boolean).length
                        ? `${shortDate(l.startISO, p.locale)}${l.endISO ? ` — ${shortDate(l.endISO, p.locale)}` : ""}`
                        : null;
                      return (
                        <Link
                          key={l.id}
                          href={`/groups/${l.groupId}`}
                          title={`${l.group} · ${hhmm(l.startMin)}–${hhmm(l.endMin)} · ${l.course}`}
                          className="absolute bottom-1.5 top-1.5 flex flex-col overflow-hidden rounded-lg px-2 py-1.5 text-xs transition hover:z-10 hover:brightness-105 hover:shadow-lg"
                          style={{ left: left + 2, width, ...cst }}
                        >
                          {/* 1-qator: guruh nomi — oq yorliq */}
                          <span className="mb-1 w-fit max-w-full truncate rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            {l.group}
                          </span>
                          {/* 2-qator: kurs + o'qituvchi (fon rangiga mos matn) */}
                          <span className="truncate text-[13px] font-semibold leading-tight">{l.course}</span>
                          {l.teacher && <span className="truncate text-[13px] leading-tight opacity-90">{l.teacher}</span>}
                          {/* Pastki qator: davr (chapda) + o'quvchilar soni (o'ngda, oq yorliq) */}
                          <span className="mt-auto flex items-end justify-between gap-1">
                            {period && <span className="truncate text-[10px] opacity-80">{period}</span>}
                            {l.students !== undefined && (
                              <span className="shrink-0 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {l.students}{l.capacity ? ` / ${l.capacity}` : ""}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sozlamalar paneli — butun ekran o'ngidan to'liq ochiladi */}
      {showSettings && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setShowSettings(false)} />
          <div className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[360px] max-w-[88%] flex-col bg-white shadow-pop dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">{t.cfgTitle}</h4>
                <p className="mt-0.5 text-xs text-slate-400">{t.cfgSub}</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {SLOTS.map((s) => (
                <div key={s.key}>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">{t[s.labelKey]}</label>
                  <select value={cfg[s.key]} onChange={(e) => setCfg({ ...cfg, [s.key]: e.target.value })} className={cn(sel, "w-full")}>
                    {FIELD_OPTS.map((f) => <option key={f} value={f}>{fieldLabel(f)}</option>)}
                  </select>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500">{t.timeRange}</label>
                <select value={rangeIdx} onChange={(e) => setRangeIdx(Number(e.target.value))} className={cn(sel, "w-full")}>
                  {RANGES.map((r, i) => <option key={r.key} value={i}>{r.key}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
              <button onClick={saveCfg} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Maxsus tooltip (Modme uslubidagi qora pufakcha)
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700">
      {children}
    </span>
  );
}

// Ko'rinish tugmasi — hoverda tooltip, bosilganda faol (ko'k) holat
function TBtn({ label, active, solo, onClick, children }: { label: string; active?: boolean; solo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="group relative flex">
      <button
        onClick={onClick}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition active:scale-90",
          active ? "bg-brand-600 text-white shadow-sm" : solo ? "bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-slate-700 dark:text-brand-400 dark:hover:bg-slate-600" : "text-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-slate-700"
        )}
      >
        {children}
      </button>
      <Tooltip>{label}</Tooltip>
    </div>
  );
}
