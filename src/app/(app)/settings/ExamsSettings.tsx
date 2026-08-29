"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const STORAGE_KEY = "gl-exams-settings";

const OPTIONS: { key: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { key: "active", label: { uz: "Imtihonlar: faol talabalarni hisobga oling", ru: "Экзамены: учитывать активных учеников", en: "Exams: count active students", de: "Prüfungen: aktive Schüler berücksichtigen" } },
  { key: "trial", label: { uz: "Imtihonlar: sinov darsidagi talabalarni hisobga oling", ru: "Экзамены: учитывать учеников на пробном уроке", en: "Exams: count students on a trial lesson", de: "Prüfungen: Schüler in der Probestunde berücksichtigen" } },
  { key: "archived", label: { uz: "Imtihonlar: arxivlangan talabalarni hisobga oling", ru: "Экзамены: учитывать архивных учеников", en: "Exams: count archived students", de: "Prüfungen: archivierte Schüler berücksichtigen" } },
  { key: "frozen", label: { uz: "Imtihonlar: muzlatilgan talabalarni hisobga oling", ru: "Экзамены: учитывать замороженных учеников", en: "Exams: count frozen students", de: "Prüfungen: pausierte Schüler berücksichtigen" } },
  { key: "deleted", label: { uz: "Imtihonlar: o'chirilgan talabalarni hisobga oling", ru: "Экзамены: учитывать удалённых учеников", en: "Exams: count deleted students", de: "Prüfungen: gelöschte Schüler berücksichtigen" } },
];

export default function ExamsSettings({ locale }: { locale: Locale }) {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const toggle = (k: string) => setState((s) => ({ ...s, [k]: !s[k] }));
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Imtihonlar", ru: "Экзамены", en: "Exams", de: "Prüfungen" })}</h2>

      <div className="max-w-2xl space-y-5">
        {OPTIONS.map((o) => (
          <div key={o.key}>
            <label className="mb-2 block text-sm text-slate-700 dark:text-slate-200">{tr(locale, o.label)}</label>
            <button
              type="button"
              onClick={() => toggle(o.key)}
              role="checkbox"
              aria-checked={!!state[o.key]}
              className={`flex h-6 w-6 items-center justify-center rounded border-2 transition ${
                state[o.key]
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800"
              }`}
            >
              {state[o.key] && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>

      <button onClick={save} className="mt-8 rounded-full bg-brand-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900">
        {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓", de: "Gespeichert ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
      </button>
    </div>
  );
}
