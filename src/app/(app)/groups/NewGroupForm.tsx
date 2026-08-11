"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { createGroup, type FormState } from "./actions";
import { GROUP_FORMATS, GROUP_FORMAT_LABELS } from "@/lib/constants";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const weekdays = (locale: Locale): { v: number; label: string }[] => [
  { v: 1, label: tr(locale, { uz: "Du", ru: "Пн", en: "Mon" }) },
  { v: 2, label: tr(locale, { uz: "Se", ru: "Вт", en: "Tue" }) },
  { v: 3, label: tr(locale, { uz: "Ch", ru: "Ср", en: "Wed" }) },
  { v: 4, label: tr(locale, { uz: "Pa", ru: "Чт", en: "Thu" }) },
  { v: 5, label: tr(locale, { uz: "Ju", ru: "Пт", en: "Fri" }) },
  { v: 6, label: tr(locale, { uz: "Sh", ru: "Сб", en: "Sat" }) },
  { v: 7, label: tr(locale, { uz: "Ya", ru: "Вс", en: "Sun" }) },
];

export { GROUP_COLORS } from "./groupColor";
import { GROUP_COLORS } from "./groupColor";

export default function NewGroupForm({
  locale,
  programs,
  teachers,
  rooms,
  open,
  onClose,
}: {
  locale: Locale;
  programs: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
  rooms: { id: string; name: string; capacity: number }[];
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGroup, {});
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [format, setFormat] = useState<string>("OFFLINE");
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState(12);
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [hideErr, setHideErr] = useState(false); // maydon o'zgarganda eski xatoni yashirish
  const formRef = useRef<HTMLFormElement>(null);

  const errMsg = (st: FormState): string => {
    switch (st.error) {
      case "room_conflict": return tr(locale, { uz: "Bu xona shu kun va vaqtda band: ", ru: "Этот кабинет занят в это время: ", en: "This room is busy at this time: " }) + (st.detail ?? "");
      case "room_required": return tr(locale, { uz: "Oflayn guruh uchun xonani tanlang.", ru: "Выберите кабинет для оффлайн-группы.", en: "Select a room for the offline group." });
      case "schedule_required": return tr(locale, { uz: "Kunlar va dars vaqtini to'ldiring.", ru: "Заполните дни и время занятий.", en: "Fill in days and lesson time." });
      case "bad_time": return tr(locale, { uz: "Tugash vaqti boshlanishdan keyin bo'lishi kerak.", ru: "Время окончания должно быть позже начала.", en: "End time must be after start time." });
      case "forbidden": return tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." });
      default: return tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "Incomplete data." });
    }
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setDays([]);
      setFormat("OFFLINE");
      setRoom("");
      setCapacity(12);
      setColor(GROUP_COLORS[0]);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const label = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
  const input = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  const toggleDay = (v: number) => { setHideErr(true); setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v])); };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        ref={formRef}
        action={action}
        onSubmit={() => setHideErr(false)}
        onChange={() => setHideErr(true)}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi guruh qo'shish", ru: "Добавить новую группу", en: "Add new group" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={label}>{tr(locale, { uz: "Nomi", ru: "Название", en: "Name" })} <span className="text-rose-500">*</span></label>
            <input name="name" required placeholder={tr(locale, { uz: "A1 ertalabki (Du-Ch-Ju)", ru: "A1 утренняя (Пн-Ср-Пт)", en: "A1 morning (Mon-Wed-Fri)" })} className={input} />
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Kurs tanlash", ru: "Выбрать курс", en: "Select course" })} <span className="text-rose-500">*</span></label>
            <select name="programId" required className={input} defaultValue="">
              <option value="" disabled>{tr(locale, { uz: "Variantlarni tanlang", ru: "Выберите вариант", en: "Select an option" })}</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "O'qituvchini tanlang", ru: "Выберите преподавателя", en: "Select teacher" })}</label>
            <select name="teacherId" className={`${input} truncate`} defaultValue="">
              <option value="">{tr(locale, { uz: "Variantlarni tanlang", ru: "Выберите вариант", en: "Select an option" })}</option>
              {teachers.map((tt) => <option key={tt.id} value={tt.id}>{tt.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}</label>
            <input name="levelCode" placeholder="A1.2" className={input} />
          </div>

          {/* O'quv shakli */}
          <div>
            <label className={label}>{tr(locale, { uz: "O'quv shakli", ru: "Формат обучения", en: "Study format" })}</label>
            <select name="format" value={format} onChange={(e) => setFormat(e.target.value)} className={input}>
              {GROUP_FORMATS.map((f) => <option key={f} value={f}>{GROUP_FORMAT_LABELS[f][locale]}</option>)}
            </select>
          </div>
          {(format === "ONLINE" || format === "HYBRID") && (
            <div>
              <label className={label}>{tr(locale, { uz: "Onlayn havola", ru: "Онлайн-ссылка", en: "Online link" })}</label>
              <input name="onlineLink" type="url" placeholder="https://zoom.us/j/..." className={input} />
            </div>
          )}

          {/* Rang */}
          <div>
            <label className={label}>{tr(locale, { uz: "Rang", ru: "Цвет", en: "Color" })}</label>
            <div className="flex flex-wrap items-center gap-2">
              {GROUP_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-slate-500 ring-offset-2 dark:ring-offset-[#15243d]" : "hover:scale-110"}`}
                  style={{ background: c }} />
              ))}
              <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-white/80 dark:border-slate-600" style={{ background: color }} title={tr(locale, { uz: "Boshqa rang", ru: "Другой цвет", en: "Custom color" })}>
                <span className="text-[11px] font-bold">+</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <span className="text-xs uppercase text-slate-400">{color}</span>
            </div>
            <input type="hidden" name="color" value={color} />
          </div>

          {/* Kunlar */}
          <div>
            <label className={label}>{tr(locale, { uz: "Kunlar", ru: "Дни", en: "Days" })}</label>
            <div className="flex flex-wrap gap-1.5">
              {weekdays(locale).map((d) => {
                const active = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={`h-9 w-11 rounded-lg border text-sm font-semibold transition ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="weekdays" value={days.join(",")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time" })}</label>
              <input name="startTime" type="time" className={input} />
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Tugash vaqti", ru: "Время окончания", en: "End time" })}</label>
              <input name="endTime" type="time" className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room" })}</label>
              <select
                name="room"
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  const r = rooms.find((x) => x.name === e.target.value);
                  if (r && r.capacity > 0) setCapacity(r.capacity);
                }}
                className={input}
              >
                <option value="">{rooms.length ? tr(locale, { uz: "— xonani tanlang —", ru: "— выберите кабинет —", en: "— select room —" }) : tr(locale, { uz: "Xona yo'q (Sozlamalar → Xonalar)", ru: "Нет кабинетов", en: "No rooms" })}</option>
                {rooms.map((r) => <option key={r.id} value={r.name}>{r.name}{r.capacity > 0 ? ` — ${r.capacity} ${tr(locale, { uz: "o'rin", ru: "мест", en: "seats" })}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Sig'im", ru: "Вместимость", en: "Capacity" })} {room && <span className="text-[10px] font-normal text-emerald-500">({tr(locale, { uz: "avto", ru: "авто", en: "auto" })})</span>}</label>
              <input name="capacity" type="number" min="1" max="100" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Boshlanish sanasi", ru: "Дата начала", en: "Start date" })}</label>
              <input name="startDate" type="date" className={input} />
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Tugash sanasi", ru: "Дата окончания", en: "End date" })}</label>
              <input name="endDate" type="date" className={input} />
            </div>
          </div>

          {state.error && !hideErr && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {errMsg(state)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
          </button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
