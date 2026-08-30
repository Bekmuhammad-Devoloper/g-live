"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { savePortalFlags, type PortalState } from "./actions";

export interface FeatureRow {
  key: string;
  path: string;
  icon: string;
  label: string;
  desc: string;
  on: boolean;
}

export default function PortalFeaturesView({ rows, locale }: { rows: FeatureRow[]; locale: Locale }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(savePortalFlags, {});
  const [flags, setFlags] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.on]))
  );

  const toggle = (k: string) => setFlags((f) => ({ ...f, [k]: !f[k] }));
  const onCount = Object.values(flags).filter(Boolean).length;

  return (
    <form action={action}>
      {/* Yashirin maydonlar — server action shular orqali o'qiydi */}
      {rows.map((r) => (
        <input key={r.key} type="hidden" name={r.key} value={flags[r.key] ? "on" : "off"} />
      ))}

      <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        {tr(locale, {
          uz: "O'chirilgan bo'lim o'quvchi portalida ko'rinmaydi va manzil orqali ham ochilmaydi.",
          ru: "Отключённый раздел не виден в портале ученика и не открывается по ссылке.",
          en: "A disabled section is hidden from the student portal and cannot be opened by URL.",
          de: "Ein deaktivierter Bereich ist im Schülerportal nicht sichtbar und nicht per URL erreichbar.",
        })}
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const on = flags[r.key];
          return (
            <div
              key={r.key}
              className="flex items-center gap-3.5 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
            >
              <span className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition",
                on ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                   : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              )}>
                <Icon name={r.icon} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 dark:text-slate-100">{r.label}</div>
                <div className="text-xs text-slate-400">{r.desc}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-300 dark:text-slate-600">{r.path}</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(r.key)}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}
              >
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Speichern..." })
                   : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
        </button>

        <span className="text-xs text-slate-400">
          {tr(locale, { uz: "Yoqilgan", ru: "Включено", en: "Enabled", de: "Aktiv" })}: <b className="text-slate-600 dark:text-slate-300">{onCount} / {rows.length}</b>
        </span>

        {state.ok && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-4 w-4" /> {tr(locale, { uz: "Saqlandi", ru: "Сохранено", en: "Saved", de: "Gespeichert" })}
          </span>
        )}
        {state.error && (
          <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
            {tr(locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No access", de: "Kein Zugriff" })}
          </span>
        )}
      </div>
    </form>
  );
}
