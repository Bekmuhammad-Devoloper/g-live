"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { COUNTRIES } from "../links/platforms";
import { saveVacancy } from "./actions";
import type { VVacancy } from "./VacanciesView";

const inp =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

export default function VacancyDrawer({ locale, edit, onClose, onSaved }: {
  locale: Locale; edit: VVacancy | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState(edit?.countryCode ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const c = COUNTRIES.find((x) => x.code === countryCode);
    fd.set("countryCode", countryCode);
    fd.set("country", c?.name ?? "");
    start(async () => {
      const r = await saveVacancy(fd);
      if (r.ok) onSaved(edit ? L("Saqlandi", "Сохранено", "Saved") : L("Vakansiya yaratildi", "Вакансия создана", "Vacancy created"));
      else setErr(r.error ?? L("Xatolik", "Ошибка", "Error"));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        {edit && <input type="hidden" name="id" value={edit.id} />}

        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <Icon name="building" className="h-5 w-5 text-brand-500" />
            {edit ? L("Vakansiyani tahrirlash", "Редактировать вакансию", "Edit vacancy") : L("Yangi vakansiya", "Новая вакансия", "New vacancy")}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <Field label={L("Vakansiya nomi", "Название вакансии", "Vacancy title")} required>
            <input name="title" required defaultValue={edit?.title ?? ""} autoFocus
              placeholder={L("Masalan: Qassobchilik", "Например: Мясник", "e.g. Butcher")} className={inp} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L("Kompaniya", "Компания", "Company")}>
              <input name="company" defaultValue={edit?.company ?? ""} placeholder="GL" className={inp} />
            </Field>
            <Field label={L("Davlat", "Страна", "Country")}>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={inp}>
                <option value="">{L("— tanlanmagan —", "— не выбрано —", "— not selected —")}</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L("Ish turi", "Тип работы", "Job type")}>
              <input name="jobTitle" defaultValue={edit?.jobTitle ?? ""}
                placeholder={L("Masalan: Ishlab chiqarish", "Например: Производство", "e.g. Production")} className={inp} />
            </Field>
            <Field label={L("Oylik", "Зарплата", "Salary")}>
              <input name="salary" defaultValue={edit?.salary ?? ""} placeholder="2000-2500 €" className={inp} />
            </Field>
          </div>

          <Field label={L("Tavsif / talablar", "Описание / требования", "Description / requirements")}>
            <textarea name="description" defaultValue={edit?.description ?? ""} rows={5}
              placeholder={L("Ish sharoitlari, talablar, qo'shimcha ma'lumot...", "Условия работы, требования, доп. информация...", "Working conditions, requirements, extra info...")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          </Field>

          <label className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-white/[0.03]">
            <input type="checkbox" name="isActive" value="true" defaultChecked={edit ? edit.isActive : true}
              className="h-4 w-4 rounded accent-brand-600" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {L("Faol (arizalar qabul qilinadi)", "Активна (заявки принимаются)", "Active (accepting applications)")}
            </span>
          </label>
          {/* checkbox belgilanmasa "false" yuborilishi uchun */}
          <input type="hidden" name="isActive" value="false" />

          {edit && edit.linkCount > 0 && (
            <p className="rounded-xl bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-700 dark:text-blue-300">
              {L(`Bu vakansiyada ${edit.linkCount} ta havola bor.`, `У этой вакансии ${edit.linkCount} ссылок.`, `This vacancy has ${edit.linkCount} link(s).`)}
            </p>
          )}

          {err && <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{err}</div>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            {L("Bekor qilish", "Отмена", "Cancel")}
          </button>
          <button type="submit" disabled={pending}
            className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {pending ? L("Saqlanmoqda...", "Сохранение...", "Saving...") : L("Saqlash", "Сохранить", "Save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
