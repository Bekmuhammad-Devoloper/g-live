"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const STORAGE_KEY = "gl-account-settings";

const MODES: { value: string; label: { uz: string; ru: string; en: string } }[] = [
  { value: "Oylik (kalendar oyiga)", label: { uz: "Oylik (kalendar oyiga)", ru: "Помесячно (по календарному месяцу)", en: "Monthly (by calendar month)" } },
  { value: "Oylik (30 kunlik)", label: { uz: "Oylik (30 kunlik)", ru: "Помесячно (30 дней)", en: "Monthly (30 days)" } },
  { value: "Kunlik", label: { uz: "Kunlik", ru: "Ежедневно", en: "Daily" } },
  { value: "Kurs bo'yicha", label: { uz: "Kurs bo'yicha", ru: "По курсу", en: "By course" } },
  { value: "Modul bo'yicha", label: { uz: "Modul bo'yicha", ru: "По модулю", en: "By module" } },
  { value: "Individual", label: { uz: "Individual", ru: "Индивидуально", en: "Individual" } },
];

const OPTS: { key: string; label: { uz: string; ru: string; en: string } }[] = [
  { key: "teacherSms", label: { uz: "O'qituvchilarga: talabalarga SMS yuborishga ruxsat bering", ru: "Преподавателям: разрешить отправку SMS ученикам", en: "Teachers: allow sending SMS to students" } },
  { key: "hideStudentInfo", label: { uz: "O'qituvchilarga: talabalar ma'lumotlarini yashirish", ru: "Преподавателям: скрывать данные учеников", en: "Teachers: hide student information" } },
  { key: "attendanceDuringLesson", label: { uz: "O'qituvchilar: davomatni faqat dars davomida belgilash", ru: "Преподаватели: отмечать посещаемость только во время урока", en: "Teachers: mark attendance only during the lesson" } },
  { key: "allowOverlap", label: { uz: "Jadval: guruhlarni bitta kabinet / o'qituvchi bilan kesib o'tishga ruxsat bering", ru: "Расписание: разрешить пересечение групп по одному кабинету / преподавателю", en: "Schedule: allow groups to overlap in one room / teacher" } },
  { key: "showGroupBalance", label: { uz: "Guruh balansini ko'rsatish", ru: "Показывать баланс группы", en: "Show group balance" } },
];

interface Form { mode: string; opts: Record<string, boolean> }

export default function AccountSettings({ locale }: { locale: Locale }) {
  const [f, setF] = useState<Form>({ mode: MODES[0].value, opts: {} });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setF((cur) => ({ ...cur, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  const toggle = (k: string) => setF((s) => ({ ...s, opts: { ...s.opts, [k]: !s.opts[k] } }));
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Hisob va to'lovlar", ru: "Счёт и платежи", en: "Account and payments" })}</h2>

      <div className="max-w-3xl space-y-6">
        {/* To'lov rejimi */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
            {tr(locale, { uz: "Talabalar uchun to'lov rejimi", ru: "Режим оплаты для учеников", en: "Payment mode for students" })} <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select value={f.mode} onChange={(e) => setF((s) => ({ ...s, mode: e.target.value }))}
              className="h-12 w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3.5 pr-9 text-sm text-slate-700 outline-none focus:border-brand-400 focus:bg-white dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100">
              {MODES.map((m) => <option key={m.value} value={m.value}>{tr(locale, m.label)}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>
        </div>

        {/* Others — ruxsatlar */}
        <fieldset className="relative rounded-xl border border-slate-300 p-5 pt-6 dark:border-slate-600">
          <legend className="ml-2 px-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Boshqalar", ru: "Другое", en: "Others" })}</legend>
          <div className="space-y-4">
            {OPTS.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(o.key)}
                  role="checkbox"
                  aria-checked={!!f.opts[o.key]}
                  className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                    f.opts[o.key] ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800")}>
                  {f.opts[o.key] && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m5 12 5 5L20 7" /></svg>}
                </button>
                <span className="text-sm text-slate-700 dark:text-slate-200" onClick={() => toggle(o.key)}>{tr(locale, o.label)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button onClick={save} className="rounded-full bg-brand-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900">
          {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
        </button>
      </div>
    </div>
  );
}
