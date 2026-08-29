"use client";

import { cn } from "@/lib/cn";
import { formatMoney, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { columnDef, columnOf, type VLead } from "../_lib/leadColumns";

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

interface Props {
  lead: VLead;
  locale: Locale;
  selected: boolean;
  onOpen: (id: string, e: React.MouseEvent) => void;
  /** Ikki marta bosilganda — lidning to'liq sahifasi */
  onOpenFull: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export default function LeadCard({ lead, locale, selected, onOpen, onOpenFull, onDragStart, onDragEnd }: Props) {
  const col = columnDef(columnOf(lead.stage));
  const color = col.color;
  const days = daysSince(lead.createdAt);
  const stuck = (col.key === "new" || col.key === "work") && days >= 3;

  const parts = lead.fullName.split(" ").filter(Boolean);
  const first = parts[0] ?? lead.fullName;
  const rest = parts.slice(1).join(" ");

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(lead.id, e)}
      onDragEnd={onDragEnd}
      // 1 marta -> yonbosh tezkor oyna, 2 marta -> to'liq sahifa
      onClick={(e) => onOpen(lead.id, e)}
      onDoubleClick={() => onOpenFull(lead.id)}
      className={cn(
        "group cursor-pointer select-none rounded-xl border bg-[#ffffff] p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#15243d]",
        selected ? "border-brand-500 ring-2 ring-brand-500/40" : "border-slate-200 dark:border-white/[0.07]"
      )}
    >
      {/* Avatar + ism */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/40"
          style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
        >
          <Icon name="user" className="h-6 w-6 text-slate-400" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{first}</span>
                {stuck && <span className="shrink-0 text-xs font-bold text-red-500">{days} {tr(locale, { uz: "kun", ru: "дн.", en: "days", de: "Tage" })}</span>}
              </div>
              {rest && <div className="truncate text-xs text-slate-400">{rest}</div>}
            </div>
            {lead.activityCount > 0 && (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{lead.activityCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Telefon + manba + kurs */}
      <div className="mt-2.5 space-y-1.5">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: lead.phone, leadId: lead.id, contactName: lead.fullName } })); }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={tr(locale, { uz: "Qo'ng'iroq qilish", ru: "Позвонить", en: "Call", de: "Anrufen" })}
          className="flex items-center gap-2 text-sm transition hover:opacity-70"
        >
          <Icon name="phone" className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
          <span className="font-medium text-slate-600 dark:text-slate-200">{lead.phone}</span>
        </button>
        {lead.source && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Icon name="download" className="h-3.5 w-3.5" /> {lead.source}
          </div>
        )}
        {lead.interestCourse && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Icon name="building" className="h-3.5 w-3.5" /> {lead.interestCourse}
          </div>
        )}
        {/* Yosh va daraja — ariza formasidan keladi */}
        {(lead.age || lead.level) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {lead.age ? <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">{lead.age} {tr(locale, { uz: "yosh", ru: "лет", en: "y.o.", de: "J." })}</span> : null}
            {lead.level ? <span className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">{lead.level}</span> : null}
          </div>
        )}
        {lead.budget ? <div className="text-xs font-semibold text-emerald-500">{formatMoney(lead.budget, locale)}</div> : null}
      </div>

      {/* Ajratuvchi */}
      <div className="my-2.5 h-px bg-slate-100 dark:bg-white/[0.06]" />

      {/* Menejer + bosqich */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <Icon name="user" className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.managerName ?? "—"}</span>
        </span>
        <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ color, background: `${color}1f` }}>
          {label(LEAD_STAGE_LABELS, lead.stage, locale)}
        </span>
      </div>

      {/* Sana + ustun tegi */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{fmtDate(lead.createdAt)}</span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color, background: `${color}14` }}>{tr(locale, col.label)}</span>
      </div>
    </div>
  );
}
