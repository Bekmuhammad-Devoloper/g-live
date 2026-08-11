"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { createAssessment, type FormState } from "./actions";
import { SEASONS, SEASON_LABELS, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";

export default function NewAssessmentForm({
  groups,
  open,
  onClose,
  locale,
}: {
  groups: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const SKILLS = [
    { v: "GENERAL", label: tr(locale, { uz: "Umumiy", ru: "Общее", en: "General" }) },
    { v: "SPEAKING", label: "Speaking" },
    { v: "WRITING", label: "Writing" },
    { v: "READING", label: "Reading" },
    { v: "LISTENING", label: "Listening" },
    { v: "GRAMMAR", label: "Grammar" },
  ];
  const [state, action, pending] = useActionState<FormState, FormData>(createAssessment, {});
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
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

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        ref={formRef}
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi mavsumiy baholash", ru: "Новое сезонное оценивание", en: "New seasonal assessment" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={label}>{tr(locale, { uz: "Nomi", ru: "Название", en: "Name" })} <span className="text-rose-500">*</span></label>
            <input name="title" required placeholder={tr(locale, { uz: "Qish mavsumi — oraliq baholash", ru: "Зимний сезон — промежуточное оценивание", en: "Winter season — interim assessment" })} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Mavsum", ru: "Сезон", en: "Season" })} <span className="text-rose-500">*</span></label>
              <select name="season" required className={input} defaultValue="WINTER">
                {SEASONS.map((v) => <option key={v} value={v}>{SEASON_LABELS[v][locale]}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Yil", ru: "Год", en: "Year" })} <span className="text-rose-500">*</span></label>
              <input name="year" type="number" min="2000" max="2100" required defaultValue={currentYear} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</label>
            <select name="groupId" className={input} defaultValue="">
              <option value="">{tr(locale, { uz: "Guruhsiz (umumiy)", ru: "Без группы (общее)", en: "No group (general)" })}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}</label>
              <input name="levelCode" placeholder="A1.2" className={input} />
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Ko'nikma", ru: "Навык", en: "Skill" })}</label>
              <select name="skill" className={input} defaultValue="GENERAL">
                {SKILLS.map((sk) => <option key={sk.v} value={sk.v}>{sk.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Maksimal ball", ru: "Максимальный балл", en: "Maximum score" })}</label>
              <input name="maxScore" type="number" min="1" max="1000" defaultValue={100} className={input} />
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "O'tish balli", ru: "Проходной балл", en: "Passing score" })}</label>
              <input name="passScore" type="number" min="0" max="1000" defaultValue={60} className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })}</label>
              <input name="date" type="date" className={input} />
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Holat", ru: "Статус", en: "Status" })}</label>
              <select name="status" className={input} defaultValue="PLANNED">
                <option value="PLANNED">{tr(locale, { uz: "Rejalashtirilgan", ru: "Запланировано", en: "Planned" })}</option>
                <option value="ONGOING">{tr(locale, { uz: "Jarayonda", ru: "В процессе", en: "Ongoing" })}</option>
                <option value="COMPLETED">{tr(locale, { uz: "Yakunlangan", ru: "Завершено", en: "Completed" })}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })}</label>
            <textarea name="note" rows={2} placeholder={tr(locale, { uz: "Qo'shimcha izoh", ru: "Дополнительный комментарий", en: "Additional note" })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          </div>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "The data is incomplete." })}
            </p>
          )}
        </div>

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
