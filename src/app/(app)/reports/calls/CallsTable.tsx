"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import UserAvatar from "../../_components/UserAvatar";
import Waveform from "./Waveform";
import { DIR, STATUS, toneCls } from "./meta";
import type { VCall } from "./types";

interface Props {
  rows: VCall[];
  locale: Locale;
  total: number;
  start: number;
  pageSize: number;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  loadedNote: string | null;
}

export default function CallsTable({ rows, locale, total, start, pageSize, page, pageCount, onPage, loadedNote }: Props) {
  const head = [
    tr(locale, { uz: "Vaqt", ru: "Время", en: "Time", de: "Zeit" }),
    tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" }),
    tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }),
    tr(locale, { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" }),
    tr(locale, { uz: "Abonent", ru: "Абонент", en: "Contact", de: "Kontakt" }),
    tr(locale, { uz: "Davomiylik", ru: "Длительность", en: "Duration", de: "Dauer" }),
    tr(locale, { uz: "Audio yozuv", ru: "Аудиозапись", en: "Recording", de: "Aufnahme" }),
    tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment", de: "Kommentar" }),
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Icon name="phone" className="h-7 w-7 text-slate-300 dark:text-slate-600" />
        </div>
        <p className="font-medium text-slate-500 dark:text-slate-400">
          {tr(locale, { uz: "Qo'ng'iroq topilmadi", ru: "Звонки не найдены", en: "No calls found", de: "Keine Anrufe gefunden" })}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {tr(locale, { uz: "Filtrlarni o'zgartirib ko'ring", ru: "Попробуйте изменить фильтры", en: "Try changing the filters", de: "Versuchen Sie, die Filter zu ändern" })}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                {head.map((h) => (
                  <th key={h} className="px-4 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.map((c) => {
                const st = STATUS[c.status] ?? STATUS.FAILED;
                const dir = DIR[c.direction] ?? DIR.INCOMING;
                return (
                  <tr key={c.id} className="align-middle transition-colors hover:bg-blue-50/30 dark:hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{c.dayLabel}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{c.timeLabel}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", toneCls[dir.tone])}>
                        <Icon name={dir.icon} className="h-3.5 w-3.5" /> {tr(locale, dir.label)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", toneCls[st.tone])}>
                        <Icon name={st.icon} className="h-3.5 w-3.5" /> {tr(locale, st.label)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.operatorName ? (
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={c.operatorName} role="MANAGER" size="sm" className="!h-8 !w-8" />
                          <span className="max-w-[130px] truncate text-sm font-medium text-slate-800 dark:text-slate-200">{c.operatorName}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">
                          {tr(locale, { uz: "Belgilanmagan", ru: "Не указан", en: "Unassigned", de: "Nicht zugewiesen" })}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className={cn("text-sm font-semibold", c.phoneUnknown ? "italic text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white")}>
                        {c.phoneLabel}
                      </div>
                      {c.contactName ? (
                        c.leadId ? (
                          <Link href={`/crm/${c.leadId}`} className="mt-0.5 block max-w-[180px] truncate text-xs text-brand-600 hover:underline dark:text-brand-400">
                            {c.contactName}
                          </Link>
                        ) : (
                          <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">{c.contactName}</div>
                        )
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 font-mono text-sm", c.duration > 0 ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>
                        <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                        {c.durationLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.recordingSrc ? (
                        <Waveform id={c.id} src={c.recordingSrc} duration={c.duration} timeLabel={c.timeLabel} locale={locale} />
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400" title={c.comment ?? undefined}>
                        {c.comment || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sahifalash */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {start + 1}–{Math.min(start + pageSize, total)}
          </span>{" "}
          / {total} {tr(locale, { uz: "ta qo'ng'iroq", ru: "звонков", en: "calls", de: "Anrufe" })}
          {loadedNote && <span className="ml-2 text-xs text-slate-400">({loadedNote})</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <PgBtn disabled={page <= 1} onClick={() => onPage(page - 1)} label={tr(locale, { uz: "Oldingi", ru: "Назад", en: "Previous", de: "Zurück" })}>
            <Icon name="chevronDown" className="h-4 w-4 rotate-90" />
          </PgBtn>
          <span className="min-w-[70px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {page} / {pageCount}
          </span>
          <PgBtn disabled={page >= pageCount} onClick={() => onPage(page + 1)} label={tr(locale, { uz: "Keyingi", ru: "Вперёд", en: "Next", de: "Weiter" })}>
            <Icon name="chevronDown" className="h-4 w-4 -rotate-90" />
          </PgBtn>
        </div>
      </div>
    </>
  );
}

function PgBtn({ children, disabled, onClick, label }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition enabled:hover:bg-slate-50 disabled:opacity-30 disabled:shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:enabled:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}
