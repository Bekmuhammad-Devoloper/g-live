"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import DemoAvatar from "../../_components/DemoAvatar";
import { columnDef, columnOf, type VLead } from "../_lib/leadColumns";
import { debtTone, debtMonthsLabel, DEBT_BADGE, DEBT_TEXT } from "@/lib/debtTone";

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface Props {
  lead: VLead;
  locale: Locale;
  selected: boolean;
  onOpen: (id: string, e: React.MouseEvent) => void;
  onOpenFull: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete?: (id: string) => void;
}

const chip = "inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium";
const softChip = "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300";

export default memo(function LeadCard({ lead, locale, selected, onOpen, onOpenFull, onDragStart, onDragEnd, onDelete }: Props) {
  const col = columnDef(columnOf(lead.stage));
  const color = col.color;
  const days = daysSince(lead.createdAt);
  const stuck = (col.key === "new" || col.key === "work") && days >= 3;
  const tone = debtTone(lead.debt ?? 0, lead.debtMonths ?? 1, lead.credit ?? 0);
  const hasExtra = lead.testPct != null || !!lead.budget || (lead.debt ?? 0) > 0 || (lead.credit ?? 0) > 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(lead.id, e)}
      onDragEnd={onDragEnd}
      onClick={(e) => onOpen(lead.id, e)}
      onDoubleClick={() => onOpenFull(lead.id)}
      className={cn(
        "group relative cursor-pointer select-none overflow-hidden rounded-xl border bg-white p-3 pl-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900",
        selected ? "border-brand-500 ring-2 ring-brand-500/40" : "border-slate-200 hover:border-slate-300 dark:border-white/[0.07] dark:hover:border-white/[0.14]",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />

      <div className="flex items-start gap-2.5" title={lead.fullName}>
        <DemoAvatar size={38} ringColor={color} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("truncate text-[13.5px] font-semibold leading-snug", tone === "none" ? "text-slate-800 dark:text-slate-100" : DEBT_TEXT[tone])}>{lead.fullName}</span>
            {stuck && (
              <span className="shrink-0 rounded bg-red-500/10 px-1 py-px text-[10px] font-bold text-red-500">
                {days} {tr(locale, { uz: "kun", ru: "дн.", en: "d", de: "T." })}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: lead.phone, leadId: lead.id, contactName: lead.fullName } })); }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={tr(locale, { uz: "Qo'ng'iroq qilish", ru: "Позвонить", en: "Call", de: "Anrufen" })}
            className="mt-0.5 inline-flex max-w-full items-center gap-1.5 rounded text-[12.5px] font-medium tabular-nums text-slate-600 transition hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <Icon name="phone" className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="truncate">{lead.phone}</span>
          </button>
        </div>
        {onDelete && col.key === "test" && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(lead.id); }}
            onDoubleClick={(e) => e.stopPropagation()}
            title={tr(locale, { uz: "Lidni o'chirish", ru: "Удалить лид", en: "Delete lead", de: "Lead löschen" })}
            className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-300 opacity-60 transition hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-500/10"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
          <span className={cn(chip, "font-semibold")} style={{ color, background: `${color}1f` }}>
            {label(LEAD_STAGE_LABELS, lead.stage, locale)}
          </span>
          {lead.source && (
            <span className={cn(chip, softChip)}>
              <Icon name="download" className="h-3 w-3 shrink-0" /> {lead.source}
            </span>
          )}
          {lead.studyFormat && (
            <span className={cn(chip, "font-semibold", lead.studyFormat === "ONLINE" ? "bg-sky-500/10 text-sky-600 dark:text-sky-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
              {lead.studyFormat === "ONLINE" ? tr(locale, { uz: "onlayn", ru: "онлайн", en: "online", de: "online" }) : tr(locale, { uz: "oflayn", ru: "офлайн", en: "offline", de: "präsenz" })}
              {lead.studyFormat !== "ONLINE" && lead.branchName && <span className="truncate font-normal opacity-80">· {lead.branchName}</span>}
            </span>
          )}
          {lead.level && <span className={cn(chip, "bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300")}>{lead.level}</span>}
          {lead.age ? <span className={cn(chip, softChip)}>{lead.age} {tr(locale, { uz: "yosh", ru: "лет", en: "y.o.", de: "J." })}</span> : null}
          {lead.telegram && (
            <span className={cn(chip, softChip)}>
              <Icon name="telegram" className="h-3 w-3 shrink-0" /> {lead.telegram}
            </span>
          )}
          {lead.interestCourse && (
            <span className={cn(chip, softChip)}>
              <Icon name="book" className="h-3 w-3 shrink-0" /> {lead.interestCourse}
            </span>
          )}
      </div>

      {hasExtra && (
        <div className="mt-2 space-y-1.5">
          {lead.testPct != null && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold",
                lead.testPassed
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
              )}
              title={tr(locale, { uz: "Daraja testi natijasi", ru: "Результат теста уровня", en: "Level test result", de: "Ergebnis des Einstufungstests" })}
            >
              <Icon name="clipboard" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {lead.testSet ? `${lead.testSet} · ` : ""}{lead.testPct}%
                {lead.testLevel ? ` · ${lead.testLevel}` : ` · ${tr(locale, { uz: "o'tmadi", ru: "не сдал", en: "failed", de: "nicht bestanden" })}`}
              </span>
            </div>
          )}
          {lead.budget ? <div className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(lead.budget, locale)}</div> : null}
          {lead.debt && lead.debt > 0 ? (
            <div
              title={debtMonthsLabel(lead.debtMonths ?? 1, locale)}
              className={cn("inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums", DEBT_BADGE[debtTone(lead.debt, lead.debtMonths ?? 1)])}
            >
              {tr(locale, { uz: "Qarz", ru: "Долг", en: "Debt", de: "Schuld" })}: {formatMoney(lead.debt, locale)}
              <span className="font-medium opacity-75">· {debtMonthsLabel(lead.debtMonths ?? 1, locale)}</span>
            </div>
          ) : lead.credit && lead.credit > 0 ? (
            <div className={cn("inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums", DEBT_BADGE.credit)}>
              {tr(locale, { uz: "Balans", ru: "Баланс", en: "Balance", de: "Guthaben" })}: +{formatMoney(lead.credit, locale)}
            </div>
          ) : null}
        </div>
      )}

      {lead.stage === "LOST" && (lead.lostBy || lead.lostAt || lead.lossReason) && (
        <div className="mt-2 rounded-lg border border-rose-200/70 bg-rose-50 px-2.5 py-1.5 text-[11px] leading-snug text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="font-semibold">{tr(locale, { uz: "Yo'qotdi", ru: "Потерял", en: "Lost by", de: "Verloren von" })}:</span> {lead.lostBy ?? "—"}{lead.lostAt ? ` · ${fmtDateTime(lead.lostAt)}` : ""}
          {lead.lossReason && <div className="mt-0.5 break-words text-rose-600/90 dark:text-rose-300/90">{lead.lossReason}</div>}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Icon name="user" className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">{lead.managerName ?? "—"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] tabular-nums text-slate-400">
          {lead.activityCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-300"
              title={tr(locale, { uz: "Harakatlar soni", ru: "Количество действий", en: "Activity count", de: "Anzahl Aktionen" })}
            >
              <Icon name="history" className="h-3 w-3" /> {lead.activityCount}
            </span>
          )}
          {fmtDate(lead.createdAt)}
        </span>
      </div>
    </div>
  );
});
