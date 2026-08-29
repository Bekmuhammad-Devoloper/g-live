"use client";

import { cn } from "@/lib/cn";
import { formatMoney, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { columnDef, columnOf, initials, type VLead } from "../_lib/leadColumns";

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

interface Props {
  leads: VLead[];
  locale: Locale;
  selected: Set<string>;
  onToggle: (id: string, e: React.MouseEvent) => void;
  onOpen: (id: string, e: React.MouseEvent) => void;
  /** Ikki marta bosilganda — lidning to'liq sahifasi */
  onOpenFull: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
}

export default function LeadsTable({ leads, locale, selected, onToggle, onOpen, onOpenFull, allSelected, onToggleAll }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
              </th>
              <th className="px-4 py-3">{tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Manba", ru: "Источник", en: "Source", de: "Quelle" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Bosqich", ru: "Этап", en: "Stage", de: "Phase" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Menejer", ru: "Менеджер", en: "Manager", de: "Manager" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Byudjet", ru: "Бюджет", en: "Budget", de: "Budget" })}</th>
              <th className="px-4 py-3">{tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created", de: "Erstellt" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {leads.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">{tr(locale, { uz: "Lid topilmadi", ru: "Лиды не найдены", en: "No leads found", de: "Keine Leads gefunden" })}</td></tr>
            ) : (
              leads.map((l) => {
                const col = columnDef(columnOf(l.stage));
                const sel = selected.has(l.id);
                return (
                  <tr
                    key={l.id}
                    // 1 marta -> yonbosh tezkor oyna, 2 marta -> to'liq sahifa
                    className={cn("cursor-pointer select-none transition hover:bg-slate-50 dark:hover:bg-slate-800/50", sel && "bg-brand-50/60 dark:bg-brand-950/30")}
                    onClick={(e) => onOpen(l.id, e)}
                    onDoubleClick={() => onOpenFull(l.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => { e.stopPropagation(); onToggle(l.id, e); }} onDoubleClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} readOnly className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ color: col.color, background: `${col.color}1f` }}>
                          {initials(l.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800 dark:text-slate-100">{l.fullName}</div>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: l.phone, leadId: l.id, contactName: l.fullName } })); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            title={tr(locale, { uz: "Qo'ng'iroq qilish", ru: "Позвонить", en: "Call", de: "Anrufen" })}
                            className="truncate text-xs text-slate-400 transition hover:text-emerald-600 dark:hover:text-emerald-400"
                          >
                            {l.phone}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{l.source ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: col.color, background: `${col.color}1a` }}>
                        {label(LEAD_STAGE_LABELS, l.stage, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{l.managerName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{l.budget ? formatMoney(l.budget, locale) : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400">{fmt(l.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
