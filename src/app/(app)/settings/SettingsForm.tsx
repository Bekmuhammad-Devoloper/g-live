"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

const KEY = "gl:settings";

interface Prefs { centerName: string; qrMinutes: number; lowScore: number }

export default function SettingsForm({ defaults, locale = "uz" }: { defaults: { qrMinutes: number; lowScore: number }; locale?: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  // SSR bilan mos bo'lishi uchun boshlang'ich qiymatlar serverdan, keyin localStorage'dan yuklanadi
  const [prefs, setPrefs] = useState<Prefs>({ centerName: "", qrMinutes: defaults.qrMinutes, lowScore: defaults.lowScore });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Prefs>;
        setPrefs((cur) => ({
          centerName: typeof p.centerName === "string" ? p.centerName : cur.centerName,
          qrMinutes: Number.isFinite(p.qrMinutes) ? Number(p.qrMinutes) : cur.qrMinutes,
          lowScore: Number.isFinite(p.lowScore) ? Number(p.lowScore) : cur.lowScore,
        }));
      }
    } catch { /* localStorage yo'q bo'lsa e'tiborsiz qoldiramiz */ }
  }, []);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setPrefs((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = () => {
    const clean: Prefs = {
      centerName: prefs.centerName.trim(),
      qrMinutes: Math.min(120, Math.max(1, Math.round(prefs.qrMinutes) || defaults.qrMinutes)),
      lowScore: Math.min(100, Math.max(0, Math.round(prefs.lowScore) || 0)),
    };
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* ignore */ }
    setPrefs(clean);
    setSaved(true);
  };

  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{T("Biznes qoidalari", "Бизнес-правила", "Business rules", "Geschäftsregeln")}</h3>
      <div className="space-y-3">
        <div>
          <label className={lbl}>{T("O'quv markazi nomi", "Название учебного центра", "Learning centre name", "Name des Bildungszentrums")}</label>
          <input value={prefs.centerName} onChange={(e) => set("centerName", e.target.value)} placeholder="Germaniya Live" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{T("QR amal muddati (daqiqa)", "Срок действия QR (мин)", "QR validity (minutes)", "QR-Gültigkeit (Minuten)")}</label>
            <input type="number" min="1" max="120" value={prefs.qrMinutes} onChange={(e) => set("qrMinutes", Number(e.target.value))} className={inp} />
          </div>
          <div>
            <label className={lbl}>{T("Past baho chegarasi (%)", "Порог низкой оценки (%)", "Low score threshold (%)", "Schwelle für niedrige Note (%)")}</label>
            <input type="number" min="0" max="100" value={prefs.lowScore} onChange={(e) => set("lowScore", Number(e.target.value))} className={inp} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
          {T("Saqlash", "Сохранить", "Save", "Speichern")}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-4 w-4" /> {T("Saqlandi", "Сохранено", "Saved", "Gespeichert")}
          </span>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{T("Bu parametrlar shu brauzerda saqlanadi (localStorage).", "Эти параметры сохраняются в этом браузере (localStorage).", "These settings are stored in this browser (localStorage).", "Diese Einstellungen werden in diesem Browser gespeichert (localStorage).")}</p>
    </div>
  );
}
