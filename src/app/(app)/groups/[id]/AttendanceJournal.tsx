"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { getAttendanceJournal, markStudentAttendance, markAllPresent, unlockAttendance, type AttendanceJournal as Journal, type JournalDay } from "./attendanceActions";

type Student = { id: string; name: string; blocked?: boolean; lessonsThisMonth?: number };

const MONTHS: Record<Locale, string[]> = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"],
  ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
} as Record<Locale, string[]>;

const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white",
  LATE: "bg-amber-500 text-white",
  EXCUSED: "bg-sky-500 text-white",
  ABSENT: "bg-rose-500 text-white",
};

/**
 * Davomat jurnali: qatorlar — o'quvchilar, ustunlar — oyning dars sanalari (Modme uslubi).
 * Belgilash qoidalari serverda (markStudentAttendance): dars oynasi, kelajak sana, to'lov majburiyligi.
 */
export function AttendanceJournal({ groupId, students, locale }: { groupId: string; students: Student[]; locale: Locale }) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [data, setData] = useState<Journal | null>(null);
  const [loading, startLoad] = useTransition();
  const [, startSave] = useTransition();
  const [menu, setMenu] = useState<{ date: string; studentId: string } | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "rose" | "amber"; text: string } | null>(null);
  const reqRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const label = (s: string) =>
    s === "PRESENT" ? L("Bor edi", "Был", "Present", "Anwesend")
    : s === "ABSENT" ? L("Yo'q", "Нет", "Absent", "Abwesend")
    : s === "LATE" ? L("Kechikdi", "Опоздал", "Late", "Verspätet")
    : s === "EXCUSED" ? L("Sababli", "Уважит.", "Excused", "Entschuldigt") : s;

  const load = (y: number, m: number) => {
    const req = ++reqRef.current;
    startLoad(async () => {
      const r = await getAttendanceJournal(groupId, y, m);
      if (req !== reqRef.current) return;
      setData(r.ok ? r.data ?? null : null);
    });
  };
  useEffect(() => { setData(null); load(ym.y, ym.m); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [groupId, ym.y, ym.m]);

  // Bugungi (yoki eng yaqin) ustunga avtomatik aylantirish
  useEffect(() => {
    if (!data || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>("[data-today='1']");
    if (el) scrollRef.current.scrollLeft = Math.max(0, el.offsetLeft - 260);
  }, [data]);

  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const dayLabel = (iso: string) => { const [, mm, dd] = iso.split("-").map(Number); return `${dd} ${(MONTHS[locale] ?? MONTHS.uz)[mm - 1]}`; };

  const deny = (r: { closed?: boolean; future?: boolean; notLessonDay?: boolean; blocked?: boolean; lessonsThisMonth?: number }, name: string) => {
    if (r.blocked) setNotice({ tone: "rose", text: L(`${name} — shu oy ${r.lessonsThisMonth ?? 0} dars o'tildi, to'lov qilinmagan. Avval to'lovni qabul qiling.`, `${name} — в этом месяце ${r.lessonsThisMonth ?? 0} уроков, оплата не произведена.`, `${name} — ${r.lessonsThisMonth ?? 0} lessons this month, unpaid.`, `${name} — ${r.lessonsThisMonth ?? 0} Stunden, unbezahlt.`) });
    else if (r.future) setNotice({ tone: "amber", text: L("Kelajak sanaga davomat oldindan belgilanmaydi.", "Будущую дату отметить заранее нельзя.", "A future date cannot be pre-marked.", "Zukünftiges Datum kann nicht vorab markiert werden.") });
    else if (r.notLessonDay) setNotice({ tone: "amber", text: L("Bu kun dars kuni emas.", "Это не учебный день.", "Not a lesson day.", "Kein Unterrichtstag.") });
    else setNotice({ tone: "rose", text: L("Bu kun davomati yopilgan — menejer yoki direktor ruxsat berishi kerak.", "Посещаемость этого дня закрыта — нужно разрешение.", "This day is closed — a manager or director must unlock it.", "Dieser Tag ist geschlossen — Freischaltung erforderlich.") });
  };

  const setMark = (date: string, studentId: string, status: string) => {
    if (!data) return;
    setMenu(null);
    const prev = data.marks[date]?.[studentId];
    const clear = prev === status;
    // optimistik
    setData((d) => {
      if (!d) return d;
      const day = { ...(d.marks[date] ?? {}) };
      if (clear) delete day[studentId]; else day[studentId] = status;
      return { ...d, marks: { ...d.marks, [date]: day } };
    });
    startSave(async () => {
      const r = await markStudentAttendance(groupId, date, studentId, status);
      if (!r.ok) {
        setData((d) => {
          if (!d) return d;
          const day = { ...(d.marks[date] ?? {}) };
          if (prev === undefined) delete day[studentId]; else day[studentId] = prev;
          return { ...d, marks: { ...d.marks, [date]: day } };
        });
        deny(r, students.find((x) => x.id === studentId)?.name ?? "");
      }
    });
  };

  const allPresent = (date: string) => {
    setDayMenu(null);
    startSave(async () => {
      const r = await markAllPresent(groupId, date);
      if (!r.ok) deny(r, "");
      else if (r.skippedBlocked) setNotice({ tone: "amber", text: L(`${r.skippedBlocked} ta o'quvchi to'lov qilinmagani sabab belgilanmadi.`, `${r.skippedBlocked} учеников пропущены из-за неоплаты.`, `${r.skippedBlocked} skipped due to unpaid payment.`, `${r.skippedBlocked} wegen fehlender Zahlung übersprungen.`) });
      load(ym.y, ym.m);
    });
  };

  const unlock = (date: string) => {
    setDayMenu(null);
    startSave(async () => {
      const r = await unlockAttendance(groupId, date);
      if (r.ok) setNotice({ tone: "amber", text: L(`${dayLabel(date)} davomati ${r.untilLabel} gacha ochildi.`, `Посещаемость ${dayLabel(date)} открыта до ${r.untilLabel}.`, `${dayLabel(date)} unlocked until ${r.untilLabel}.`, `${dayLabel(date)} freigeschaltet bis ${r.untilLabel}.`) });
      load(ym.y, ym.m);
    });
  };

  const days: JournalDay[] = data?.days ?? [];
  const countFor = (sid: string, ok: boolean) => days.filter((d) => { const st = data?.marks[d.date]?.[sid]; return ok ? st === "PRESENT" || st === "LATE" : st === "ABSENT"; }).length;
  const navBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";

  return (
    <div onClick={() => { setMenu(null); setDayMenu(null); }}>
      {/* Oy tanlovi */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} disabled={isCurrent} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", isCurrent ? "border-slate-200 text-slate-300 dark:border-slate-700" : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300")}>
          {L("Joriy", "Текущий", "Current", "Aktuell")}
        </button>
        <button type="button" onClick={() => shift(-1)} className={navBtn} aria-label="prev"><Icon name="chevronDown" className="h-4 w-4 rotate-90" /></button>
        <span className="min-w-[90px] text-center text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
          {(MONTHS[locale] ?? MONTHS.uz)[ym.m]} {ym.y}
        </span>
        <button type="button" onClick={() => shift(1)} className={navBtn} aria-label="next"><Icon name="chevronDown" className="h-4 w-4 -rotate-90" /></button>
        {loading && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-400" />}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_STYLE[s])} />{label(s)}</span>
          ))}
        </div>
      </div>

      {notice && (
        <div className={cn("mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
          notice.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400")}>
          <span className="flex items-center gap-2"><Icon name="alert" className="h-4 w-4 shrink-0" />{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {data && days.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">{L("Bu oyda dars kunlari yo'q (guruh jadvali yoki davri bo'yicha).", "В этом месяце нет учебных дней.", "No lesson days this month.", "Keine Unterrichtstage in diesem Monat.")}</p>
      )}

      {days.length > 0 && (
        <div ref={scrollRef} className="relative overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th className="sticky left-0 z-20 min-w-[200px] bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:bg-slate-800">{L("Ism", "Имя", "Name", "Name")}</th>
                {days.map((d) => (
                  <th key={d.date} data-today={d.today ? "1" : undefined} className="relative px-1 py-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMenu(null); setDayMenu(dayMenu === d.date ? null : d.date); }}
                      className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                        d.today ? "bg-brand-600 text-white" : d.future ? "text-slate-400" : d.editable ? "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700" : "text-slate-400")}
                      title={d.closed && !d.unlockedUntilLabel ? L("Yopilgan", "Закрыто", "Closed", "Geschlossen") : d.unlockedUntilLabel ? L(`${d.unlockedUntilLabel} gacha ochiq`, `Открыто до ${d.unlockedUntilLabel}`, `Open until ${d.unlockedUntilLabel}`, `Offen bis ${d.unlockedUntilLabel}`) : undefined}
                    >
                      {dayLabel(d.date)}
                      {d.closed && !d.unlockedUntilLabel && !d.editable && <Icon name="lock" className="ml-0.5 inline h-3 w-3" />}
                    </button>
                    {dayMenu === d.date && (
                      <div onClick={(e) => e.stopPropagation()} className="absolute left-1/2 top-full z-30 mt-1 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <button type="button" disabled={!d.editable} onClick={() => allPresent(d.date)} className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
                          ✓ {L("Hammasi bor", "Все присутствуют", "All present", "Alle anwesend")}
                        </button>
                        {d.closed && !d.unlockedUntilLabel && data?.canUnlock && (
                          <button type="button" onClick={() => unlock(d.date)} className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                            {L("Davomatni ochish (24 soat)", "Открыть (24 ч)", "Unlock (24 h)", "Freischalten (24 Std.)")}
                          </button>
                        )}
                        {!d.editable && <p className="px-2 py-1 text-[11px] text-slate-400">{d.future ? L("Kelajak sana", "Будущая дата", "Future date", "Zukünftiges Datum") : L(`Yopilgan: ${d.closesAtLabel}`, `Закрыто: ${d.closesAtLabel}`, `Closed: ${d.closesAtLabel}`, `Geschlossen: ${d.closesAtLabel}`)}</p>}
                      </div>
                    )}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold text-emerald-600">{L("Bor", "Был", "Pres.", "Anw.")}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-rose-500">{L("Yo'q", "Нет", "Abs.", "Abw.")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-right text-[11px] text-slate-400">{i + 1}.</span>
                      <Link href={`/students/${s.id}`} className="max-w-[170px] truncate text-[13px] text-slate-700 hover:text-brand-600 hover:underline dark:text-slate-200">{s.name}</Link>
                      {s.blocked && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" title={L("To'lov kerak", "Нужна оплата", "Payment needed", "Zahlung erforderlich")} />}
                    </div>
                  </td>
                  {days.map((d) => {
                    const st = data?.marks[d.date]?.[s.id];
                    const before = !!data?.joined[s.id] && d.date < data.joined[s.id];
                    const open = menu?.date === d.date && menu.studentId === s.id;
                    return (
                      <td key={d.date} className={cn("relative px-1 py-1 text-center", d.today && "bg-brand-50/50 dark:bg-brand-500/5")}>
                        {before ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDayMenu(null); if (!d.editable) { deny({ future: d.future }, s.name); return; } setMenu(open ? null : { date: d.date, studentId: s.id }); }}
                            className={cn("inline-flex h-6 min-w-[52px] items-center justify-center rounded-md px-1.5 text-[10.5px] font-semibold transition",
                              st ? STATUS_STYLE[st] : d.editable ? "border border-slate-200 text-transparent hover:border-brand-400 dark:border-slate-700" : "border border-dashed border-slate-200 text-transparent dark:border-slate-800",
                              !d.editable && st && "opacity-80")}
                          >
                            {st ? label(st) : "·"}
                          </button>
                        )}
                        {open && (
                          <div onClick={(e) => e.stopPropagation()} className="absolute left-1/2 top-full z-30 mt-1 flex -translate-x-1/2 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((x) => (
                              <button key={x} type="button" onClick={() => setMark(d.date, s.id, x)} className={cn("whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold", STATUS_STYLE[x], st === x && "ring-2 ring-offset-1 ring-slate-400")}>
                                {label(x)}
                              </button>
                            ))}
                            {st && (
                              <button type="button" onClick={() => setMark(d.date, s.id, st)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={L("Belgini olib tashlash", "Снять отметку", "Clear", "Entfernen")}>✕</button>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-emerald-600">{countFor(s.id, true)}</td>
                  <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-rose-500">{countFor(s.id, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
