"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask, toggleTask, type TaskState } from "./actions";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import DateTimePicker from "../_components/DateTimePicker";

export const TASK_TYPES = ["Qo'ng'iroq", "To'lov", "Uchrashuv", "Hujjat", "Nazorat", "Boshqa"];

interface Opt {
  id: string;
  name: string;
}

export function NewTaskForm({
  kind,
  locale,
  staff,
  students,
  groups,
  buttonLabel,
}: {
  kind: "TASK" | "REMINDER";
  locale: Locale;
  staff: Opt[];
  students: Opt[];
  groups: Opt[];
  buttonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TaskState, FormData>(createTask, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setOpen(false); } }, [state.ok]);

  // Escape bilan yopish + fon scroll'ini bloklash (o'ngdan chiquvchi drawer)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
        <span className="text-base leading-none">＋</span> {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <form
            ref={ref}
            action={action}
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[460px] max-w-[92%] flex-col bg-white shadow-pop dark:bg-[#15243d]"
          >
            <input type="hidden" name="kind" value={kind} />

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{buttonLabel}</h3>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title" })} <span className="text-red-500">*</span></label>
                <input name="title" required className={input} placeholder={tr(locale, { uz: "Nima qilish kerak?", ru: "Что нужно сделать?", en: "What needs to be done?" })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Topshiriq turi", ru: "Тип задачи", en: "Task type" })}</label>
                  <select name="tag" className={input} defaultValue="">
                    <option value="">—</option>
                    {TASK_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Mas'ul shaxs", ru: "Ответственный", en: "Assignee" })}</label>
                  <select name="assigneeId" className={input} defaultValue="">
                    <option value="">{tr(locale, { uz: "— (o'zim)", ru: "— (я сам)", en: "— (myself)" })}</option>
                    {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</label>
                  <select name="studentId" className={input} defaultValue="">
                    <option value="">—</option>
                    {students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}</label>
                  <select name="groupId" className={input} defaultValue="">
                    <option value="">—</option>
                    {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Muddat", ru: "Срок", en: "Due" })}</label>
                  <DateTimePicker name="dueAt" className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Muhimlik", ru: "Приоритет", en: "Priority" })}</label>
                  <select name="priority" className={input} defaultValue="NORMAL">
                    <option value="LOW">{tr(locale, { uz: "Past", ru: "Низкий", en: "Low" })}</option>
                    <option value="NORMAL">{tr(locale, { uz: "O'rtacha", ru: "Средний", en: "Normal" })}</option>
                    <option value="HIGH">{tr(locale, { uz: "Yuqori", ru: "Высокий", en: "High" })}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })}</label>
                <textarea name="note" rows={3} className={input} />
              </div>

              {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr(locale, { uz: "Ma'lumot to'liq emas.", ru: "Данные неполные.", en: "Incomplete data." })}</p>}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}</button>
              <button type="submit" disabled={pending} className="btn-primary">{pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function ToggleTask({ id, done, locale }: { id: string; done: boolean; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); start(async () => { await toggleTask(id); router.refresh(); }); }}
      disabled={pending}
      title={done ? tr(locale, { uz: "Ochish", ru: "Открыть", en: "Reopen" }) : tr(locale, { uz: "Bajarildi", ru: "Выполнено", en: "Done" })}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-brand-500"}`}
    >
      {done && <span className="text-[11px] leading-none">✓</span>}
    </button>
  );
}
