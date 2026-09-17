"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { LessonDay } from "./_schedule";

/**
 * Profildagi dars kunlari kalendari. Oylar orasida strelka bilan yuriladi,
 * kunni bosganda pastda o'sha darsning vaqti, xonasi va (o'tgan bo'lsa)
 * davomat holati chiqadi. Rang tili: kelayotgan dars — feruza gradient,
 * o'tgan dars — och feruza va davomat nuqtasi (yashil / sariq / qizil).
 */
export type AttMark = "ok" | "late" | "absent" | "excused";

export type CalendarLabels = {
  months: string[]; weekdaysShort: string[]; weekdaysFull: string[];
  total: string; passed: string; left: string;
  today: string; legendLesson: string; legendPast: string;
  noLesson: string; tapHint: string;
  attended: string; late: string; absent: string; excused: string;
};

const TEAL = "#0e7490";
const NAVY = "#134e5e";
const ATT_COLOR: Record<AttMark, string> = { ok: "#22c55e", late: "#f59e0b", absent: "#f43f5e", excused: "#94a3b8" };

export default function LessonCalendar({ days, attendance, todayISO, initialYear, initialMonth0, monthsBefore, monthsAfter, labels: L }: {
  days: LessonDay[];
  attendance: Record<string, AttMark>;
  todayISO: string;
  initialYear: number;
  initialMonth0: number;
  monthsBefore: number;
  monthsAfter: number;
  labels: CalendarLabels;
}) {
  const [off, setOff] = useState(0); // joriy oydan siljish
  const [sel, setSel] = useState<string | null>(null);

  const base = new Date(initialYear, initialMonth0 + off, 1);
  const year = base.getFullYear(), month0 = base.getMonth();
  const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}`;

  const byIso = useMemo(() => new Map(days.map((d) => [d.iso, d])), [days]);
  const monthDays = useMemo(() => days.filter((d) => d.iso.startsWith(prefix)), [days, prefix]);
  const passed = monthDays.filter((d) => d.iso < todayISO).length;
  const left = monthDays.length - passed;

  const lead = (base.getDay() + 6) % 7; // dushanba = 0
  const total = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const iso = (day: number) => `${prefix}-${String(day).padStart(2, "0")}`;

  const selDay = sel ? byIso.get(sel) ?? null : null;
  const selDate = sel ? new Date(sel + "T12:00:00") : null;
  const selMark = sel ? attendance[sel] : undefined;
  const markText = (m: AttMark) => (m === "ok" ? L.attended : m === "late" ? L.late : m === "absent" ? L.absent : L.excused);

  const navBtn = "grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow-[0_4px_12px_rgba(19,78,94,0.14)] ring-1 ring-slate-200/70 transition active:scale-95 disabled:opacity-30";

  return (
    <div className="rounded-[26px] bg-white/70 p-4 shadow-[0_10px_30px_rgba(19,78,94,0.10)] ring-1 ring-white/70 backdrop-blur-md">
      {/* Sarlavha: oy va yil, strelkalar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[21px] font-extrabold leading-tight tracking-tight text-slate-900">{L.months[month0]}</div>
          <div className="text-[12.5px] font-semibold text-slate-400">{year}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="prev" className={navBtn} disabled={off <= -monthsBefore} onClick={() => { setOff((o) => o - 1); setSel(null); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          {off !== 0 && (
            <button type="button" className="rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow" style={{ background: TEAL }} onClick={() => { setOff(0); setSel(null); }}>
              {L.today}
            </button>
          )}
          <button type="button" aria-label="next" className={navBtn} disabled={off >= monthsAfter} onClick={() => { setOff((o) => o + 1); setSel(null); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      {/* Oy ko'rsatkichlari */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { n: monthDays.length, l: L.total, bg: `linear-gradient(135deg, ${TEAL}, ${NAVY})`, fg: "#fff" },
          { n: passed, l: L.passed, bg: "rgba(14,116,144,0.10)", fg: NAVY },
          { n: left, l: L.left, bg: "rgba(255,255,255,0.85)", fg: NAVY },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl px-3 py-2 ring-1 ring-white/60" style={{ background: s.bg, color: s.fg }}>
            <div className="text-[20px] font-extrabold leading-none">{s.n}</div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.12em] opacity-80">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Kunlar to'ri */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {L.weekdaysShort.map((w, i) => (
          <span key={w} className={`pb-1 text-[10.5px] font-bold uppercase tracking-wider ${i >= 5 ? "text-rose-400" : "text-slate-400"}`}>{w}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const dISO = iso(day);
          const lesson = byIso.get(dISO);
          const isToday = dISO === todayISO;
          const past = dISO < todayISO;
          const active = sel === dISO;
          const mark = lesson && past ? attendance[dISO] : undefined;
          let cls = "relative grid aspect-square w-full place-items-center rounded-[14px] text-[14px] font-bold transition active:scale-95 ";
          const style: CSSProperties = {};
          if (lesson && !past) {
            cls += "text-white shadow-[0_6px_14px_rgba(14,116,144,0.30)]";
            style.background = `linear-gradient(135deg, #17a2bf, ${TEAL} 60%, ${NAVY})`;
          } else if (lesson) {
            cls += "text-[#0f5d73]";
            style.background = "rgba(14,116,144,0.13)";
          } else {
            cls += past ? "text-slate-300" : "text-slate-600";
          }
          if (isToday) style.boxShadow = `0 0 0 2px #ffffff, 0 0 0 4px ${NAVY}`;
          if (active) style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px #17a2bf, 0 8px 18px rgba(14,116,144,0.35)";
          return (
            <button key={dISO} type="button" className={cls} style={style} onClick={() => setSel(active ? null : dISO)}>
              {day}
              {lesson && !past && <span className="absolute bottom-[5px] h-[4px] w-[4px] rounded-full bg-white/90" />}
              {mark && <span className="absolute bottom-[5px] h-[6px] w-[6px] rounded-full ring-2 ring-white" style={{ background: ATT_COLOR[mark] }} />}
            </button>
          );
        })}
      </div>

      {/* Tanlangan kun */}
      <div className="mt-3 overflow-hidden rounded-2xl transition-all duration-300" style={{ maxHeight: sel ? 200 : 0, opacity: sel ? 1 : 0 }}>
        {sel && selDate && (
          selDay ? (
            <div className="flex items-center gap-3 rounded-2xl p-3 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, ${NAVY})` }}>
              <div className="flex w-[54px] shrink-0 flex-col items-center rounded-xl bg-white/95 py-1.5 text-center">
                <span className="text-[10px] font-extrabold uppercase text-rose-500">{L.weekdaysShort[(selDate.getDay() + 6) % 7]}</span>
                <span className="text-[22px] font-black leading-none" style={{ color: NAVY }}>{selDate.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{selDay.group}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] font-semibold text-white/85">
                  {selDay.startTime && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                      {selDay.startTime}{selDay.endTime ? `–${selDay.endTime}` : ""}
                    </span>
                  )}
                  {selDay.room && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
                      {selDay.room}
                    </span>
                  )}
                </div>
                {selMark && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-white/25">
                    <span className="h-2 w-2 rounded-full" style={{ background: ATT_COLOR[selMark] }} /> {markText(selMark)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-100/80 px-4 py-3 text-[13px] font-semibold text-slate-500">
              {L.weekdaysFull[(selDate.getDay() + 6) % 7]}, {selDate.getDate()} {L.months[selDate.getMonth()].toLowerCase()} — {L.noLesson}
            </div>
          )
        )}
      </div>

      {/* Izoh */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px]" style={{ background: TEAL }} /> {L.legendLesson}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px]" style={{ background: "rgba(14,116,144,0.25)" }} /> {L.legendPast}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ATT_COLOR.ok }} /> {L.attended}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ATT_COLOR.absent }} /> {L.absent}</span>
        {!sel && <span className="w-full text-[11px] font-medium text-slate-400">{L.tapHint}</span>}
      </div>
    </div>
  );
}
