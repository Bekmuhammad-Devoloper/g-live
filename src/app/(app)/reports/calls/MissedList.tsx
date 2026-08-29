"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { markCalledBack } from "./actions";
import { CALLBACK, toneCls } from "./meta";
import type { VCall } from "./types";
import { useCdrSync } from "./useCdrSync";

interface Props {
  calls: VCall[];
  locale: Locale;
  canMark: boolean;
  callback: string;
  onCallback: (v: string) => void;
}

// Qabul qilinmagan qo'ng'iroqlar — eski CRM'dagi kartalar ko'rinishida.
export default function MissedList({ calls, locale, canMark, callback, onCallback }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { sync, syncing, note } = useCdrSync(locale);

  const mark = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      await markCalledBack(id);
      setBusyId(null);
      router.refresh();
    });
  };

  const callNow = (c: VCall) => {
    if (c.phoneUnknown) return;
    window.dispatchEvent(
      new CustomEvent("glive:call", { detail: { number: c.phone, leadId: c.leadId ?? undefined, contactName: c.contactName ?? undefined } }),
    );
  };

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={callback}
            onChange={(e) => onCallback(e.target.value)}
            className={cn(
              "cursor-pointer appearance-none rounded-xl border bg-slate-50 py-2.5 pl-4 pr-10 text-sm outline-none transition dark:bg-slate-800",
              callback
                ? "border-brand-300 text-slate-900 dark:border-brand-500/40 dark:text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
            )}
          >
            <option value="">{tr(locale, { uz: "Barcha qayta bog'lanishlar", ru: "Все перезвоны", en: "All callbacks", de: "Alle Rückrufe" })}</option>
            {Object.entries(CALLBACK).map(([k, v]) => (
              <option key={k} value={k}>{tr(locale, v.label)}</option>
            ))}
            <option value="NONE">{tr(locale, { uz: "Belgilanmagan", ru: "Без отметки", en: "Unmarked", de: "Nicht markiert" })}</option>
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Icon name="refresh" className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing
            ? tr(locale, { uz: "Yangilanmoqda...", ru: "Обновление...", en: "Refreshing...", de: "Wird aktualisiert..." })
            : tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })}
        </button>
        {note && (
          <span className={cn("text-sm font-medium", note.error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
            {note.text}
          </span>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
            <Icon name="check" className="h-7 w-7 text-emerald-400" />
          </div>
          <p className="font-medium text-slate-500 dark:text-slate-400">
            {tr(locale, { uz: "Qabul qilinmagan qo'ng'iroq yo'q", ru: "Пропущенных звонков нет", en: "No missed calls", de: "Keine verpassten Anrufe" })}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {tr(locale, { uz: "Barcha qo'ng'iroqlarga javob berilgan", ru: "На все звонки ответили", en: "All calls have been answered", de: "Alle Anrufe wurden beantwortet" })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((c) => {
            const isPending = c.callbackStatus === "PENDING";
            const isDone = c.callbackStatus === "CALLED_BACK";
            const cb = CALLBACK[c.callbackStatus] ?? null;
            return (
              <div
                key={c.id}
                className={cn(
                  "group relative rounded-2xl border transition hover:shadow-md",
                  isPending
                    ? "border-amber-200 bg-gradient-to-r from-amber-50/80 to-white dark:border-amber-800/60 dark:from-amber-900/10 dark:to-slate-900"
                    : isDone
                      ? "border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white dark:border-emerald-800/60 dark:from-emerald-900/10 dark:to-slate-900"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
                )}
              >
                <div className="flex flex-wrap items-center gap-4 p-5">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                      isPending
                        ? "bg-gradient-to-br from-red-400 to-red-600"
                        : isDone
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                          : "bg-gradient-to-br from-slate-300 to-slate-500",
                    )}
                  >
                    <Icon name="phoneMissed" className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cn("text-base font-bold", c.phoneUnknown ? "italic text-slate-400" : "text-slate-900 dark:text-white")}>
                        {c.phoneLabel}
                      </span>
                      {c.contactName &&
                        (c.leadId ? (
                          <Link href={`/crm/${c.leadId}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                            — {c.contactName}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">— {c.contactName}</span>
                        ))}
                      {c.leadManagerName && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                          <Icon name="headphones" className="h-3 w-3" />
                          {c.leadManagerName}
                        </span>
                      )}
                      {cb && (
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneCls[cb.tone])}>
                          <Icon name={cb.icon} className="h-3 w-3" />
                          {tr(locale, cb.label)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        {c.dayLabel} {c.timeLabel}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="text-slate-400">{c.agoLabel}</span>
                      {isDone && c.callbackAtLabel && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <Icon name="check" className="h-3.5 w-3.5" />
                            {tr(locale, CALLBACK.CALLED_BACK.label)}: {c.callbackAtLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    {isPending && !c.phoneUnknown && (
                      <button
                        onClick={() => callNow(c)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-emerald-700 active:scale-95"
                      >
                        <Icon name="phoneCall" className="h-4 w-4" />
                        {tr(locale, { uz: "Bog'lanish", ru: "Перезвонить", en: "Call back", de: "Zurückrufen" })}
                      </button>
                    )}
                    {isPending && canMark && (
                      <button
                        onClick={() => mark(c.id)}
                        disabled={pending && busyId === c.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {pending && busyId === c.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        ) : (
                          <Icon name="check" className="h-4 w-4 text-emerald-500" />
                        )}
                        {tr(locale, { uz: "Bog'landim", ru: "Отметить", en: "Mark done", de: "Als erledigt markieren" })}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
