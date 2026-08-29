"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { createAssignment, type FormState } from "./actions";

const TYPES = ["TEXT", "FILE", "AUDIO", "VIDEO", "TEST"];
const SKILLS = ["", "SPEAKING", "WRITING", "READING", "LISTENING", "GRAMMAR"];

export default function NewAssignmentForm({ groups, locale }: { groups: { id: string; name: string }[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createAssignment, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setOpen(false); } }, [state.ok]);

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  if (groups.length === 0) return null;

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        + {tr(locale, { uz: "Yangi vazifa", ru: "Новое задание", en: "New assignment", de: "Neue Aufgabe" })}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Yonboshdan ochiladigan panel (ilovadagi boshqa formalar kabi) */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <form ref={ref} action={action} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col space-y-3 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-pop dark:border-white/10 dark:bg-[#15243d]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{tr(locale, { uz: "Yangi vazifa", ru: "Новое задание", en: "New assignment", de: "Neue Aufgabe" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })} <span className="text-red-500">*</span></label>
              <select name="groupId" required className={input} defaultValue="">
                <option value="" disabled>—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title", de: "Titel" })} <span className="text-red-500">*</span></label>
              <input name="title" required className={input} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })}</label>
                <select name="type" className={input} defaultValue="TEXT">
                  {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Ko'nikma", ru: "Навык", en: "Skill", de: "Fertigkeit" })}</label>
                <select name="skill" className={input} defaultValue="">
                  {SKILLS.map((sk) => <option key={sk} value={sk}>{sk || "—"}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Max ball", ru: "Макс. балл", en: "Max score", de: "Max. Punktzahl" })}</label>
                <input name="maxScore" type="number" min="1" defaultValue={100} className={input} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Muddat", ru: "Срок", en: "Due date", de: "Frist" })}</label>
              <input name="dueAt" type="datetime-local" className={input} />
            </div>

            {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr(locale, { uz: "Xatolik yuz berdi.", ru: "Произошла ошибка.", en: "An error occurred.", de: "Ein Fehler ist aufgetreten." })}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
