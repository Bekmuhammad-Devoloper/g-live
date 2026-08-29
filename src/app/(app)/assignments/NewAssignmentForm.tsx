"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { createPortal } from "react-dom";
import { createAssignment, type FormState } from "./actions";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export const typeLabels = (locale: Locale): Record<string, string> => ({
  TASK: tr(locale, { uz: "Vazifa", ru: "Задание", en: "Task", de: "Aufgabe" }),
  EXAM: tr(locale, { uz: "Imtihon", ru: "Экзамен", en: "Exam", de: "Prüfung" }),
  HOMEWORK: tr(locale, { uz: "Uy vazifasi", ru: "Домашнее задание", en: "Homework", de: "Hausaufgabe" }),
  TEST: tr(locale, { uz: "Test", ru: "Тест", en: "Test", de: "Test" }),
});
export const SKILLS = ["SPEAKING", "WRITING", "READING", "LISTENING", "GRAMMAR"];
const SKILL_LABELS: Record<string, string> = {
  SPEAKING: "Speaking", WRITING: "Writing", READING: "Reading", LISTENING: "Listening", GRAMMAR: "Grammar",
};

export default function NewAssignmentForm({
  locale,
  groups,
  open,
  onClose,
}: {
  locale: Locale;
  groups: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const TYPE_LABELS = typeLabels(locale);
  const [state, action, pending] = useActionState<FormState, FormData>(createAssignment, {});
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok) { formRef.current?.reset(); onClose(); }
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
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Imtihon / vazifa qo'shish", ru: "Добавить экзамен / задание", en: "Add exam / assignment", de: "Prüfung / Aufgabe hinzufügen" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={label}>{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })} <span className="text-rose-500">*</span></label>
            <select name="groupId" required className={input} defaultValue="">
              <option value="" disabled>{tr(locale, { uz: "Guruhni tanlang", ru: "Выберите группу", en: "Select a group", de: "Gruppe auswählen" })}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })} <span className="text-rose-500">*</span></label>
              <select name="type" required className={input} defaultValue="TASK">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Maksimal ball", ru: "Максимальный балл", en: "Max score", de: "Höchstpunktzahl" })}</label>
              <input name="maxScore" type="number" min="1" max="1000" defaultValue={100} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} <span className="text-rose-500">*</span></label>
            <input name="title" required placeholder={tr(locale, { uz: "Masalan: A1 yakuniy imtihon", ru: "Например: итоговый экзамен A1", en: "e.g. A1 final exam", de: "z. B. A1-Abschlussprüfung" })} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr(locale, { uz: "Ko'nikma", ru: "Навык", en: "Skill", de: "Fertigkeit" })}</label>
              <select name="skill" className={input} defaultValue="">
                <option value="">—</option>
                {SKILLS.map((sk) => <option key={sk} value={sk}>{SKILL_LABELS[sk]}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{tr(locale, { uz: "Topshirish muddati", ru: "Срок сдачи", en: "Due date", de: "Fälligkeitsdatum" })}</label>
              <input name="dueAt" type="datetime-local" className={input} />
            </div>
          </div>
          <div>
            <label className={label}>{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })}</label>
            <textarea name="note" rows={3} placeholder={tr(locale, { uz: "Qo'shimcha izoh...", ru: "Дополнительное примечание...", en: "Additional note...", de: "Zusätzliche Notiz..." })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          </div>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." }) : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные неполные.", en: "Incomplete data.", de: "Daten unvollständig." })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
          </button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
