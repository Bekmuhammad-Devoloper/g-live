"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";

const KEY = "gl:grading";

interface Prefs {
  maxGrade: number;
  editPastGrades: boolean;
  staffCanGrade: boolean;
  showCenterRating: boolean;
  showBranchRating: boolean;
}

const DEFAULTS: Prefs = {
  maxGrade: 5,
  editPastGrades: false,
  staffCanGrade: false,
  showCenterRating: false,
  showBranchRating: false,
};

export default function GradingSettings({ locale }: { locale: Locale }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // SSR bilan mos bo'lishi uchun: boshlang'ich qiymatlar DEFAULTS, keyin localStorage'dan yuklanadi
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Prefs>;
        setPrefs((cur) => ({
          maxGrade: Number.isFinite(p.maxGrade) ? Number(p.maxGrade) : cur.maxGrade,
          editPastGrades: !!p.editPastGrades,
          staffCanGrade: !!p.staffCanGrade,
          showCenterRating: !!p.showCenterRating,
          showBranchRating: !!p.showBranchRating,
        }));
      }
    } catch { /* localStorage yo'q bo'lsa e'tiborsiz */ }
  }, []);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setPrefs((p) => ({ ...p, [k]: v })); setSaved(false); };
  const setMax = (v: number) => set("maxGrade", Math.min(100, Math.max(1, v)));

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    setSaved(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
      {/* Ogohlantirish banneri */}
      <div className="mb-6 flex max-w-2xl items-start gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="text-sm leading-relaxed text-emerald-700 dark:text-emerald-300">
          <div className="font-bold">{tr(locale, { uz: "Diqqat!", ru: "Внимание!", en: "Attention!" })}</div>
          <p className="mt-0.5">
            {tr(locale, { uz: "Baholash tizimi joriy qilingandan so'ng maksimum baho o'zgartirilsa, eski baholarning barchasi o'chiriladi.", ru: "После внедрения системы оценивания при изменении максимальной оценки все прежние оценки будут удалены.", en: "Once the grading system is in use, changing the maximum grade will delete all previous grades." })}
          </p>
        </div>
      </div>

      {/* Maksimum baho */}
      <div className="mb-7">
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Maksimum baho", ru: "Максимальная оценка", en: "Maximum grade" })}</div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset segmenti 5 / 10 */}
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {[5, 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMax(v)}
                className={cn(
                  "h-11 w-16 text-sm font-semibold transition",
                  prefs.maxGrade === v
                    ? "bg-blue-500 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Stepper */}
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMax(prefs.maxGrade - 1)}
              className="flex h-11 w-11 items-center justify-center text-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label={tr(locale, { uz: "Kamaytirish", ru: "Уменьшить", en: "Decrease" })}
            >
              −
            </button>
            <div className="flex h-11 w-24 items-center justify-center border-x border-slate-200 bg-white text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {prefs.maxGrade}
            </div>
            <button
              type="button"
              onClick={() => setMax(prefs.maxGrade + 1)}
              className="flex h-11 w-11 items-center justify-center text-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label={tr(locale, { uz: "Oshirish", ru: "Увеличить", en: "Increase" })}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Toggle sozlamalari */}
      <div className="space-y-6">
        <ToggleRow label={tr(locale, { uz: "O'tgan sanalar uchun bahoni tahrirlash", ru: "Редактировать оценки за прошедшие даты", en: "Edit grades for past dates" })} on={prefs.editPastGrades} onChange={(v) => set("editPastGrades", v)} />
        <ToggleRow label={tr(locale, { uz: "Ustozlardan tashqari, hodimlar ham baholashga ruxsat berish", ru: "Разрешить оценивать не только преподавателям, но и сотрудникам", en: "Allow staff, not only teachers, to grade" })} on={prefs.staffCanGrade} onChange={(v) => set("staffCanGrade", v)} />
        <ToggleRow label={tr(locale, { uz: "Talaba profilida markaz kesimida reytingni ko'rsatish", ru: "Показывать рейтинг по центру в профиле ученика", en: "Show center-wide rating on the student profile" })} on={prefs.showCenterRating} onChange={(v) => set("showCenterRating", v)} />
        <ToggleRow label={tr(locale, { uz: "Talaba profilida filial kesimida reytingni ko'rsatish", ru: "Показывать рейтинг по филиалу в профиле ученика", en: "Show branch-wide rating on the student profile" })} on={prefs.showBranchRating} onChange={(v) => set("showBranchRating", v)} />
      </div>

      {/* Saqlash */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-blue-500 px-10 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          {tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-4 w-4" /> {tr(locale, { uz: "Saqlandi", ru: "Сохранено", en: "Saved" })}
          </span>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <div className="mb-2 text-sm text-slate-700 dark:text-slate-200">{label}</div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          on ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            on ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}
