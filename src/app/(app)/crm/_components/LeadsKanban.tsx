"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS, columnOf, type VLead } from "../_lib/leadColumns";
import LeadCard from "./LeadCard";

interface Props {
  leads: VLead[];
  totals: Record<string, number>;
  locale: Locale;
  selected: Set<string>;
  onOpen: (id: string, e: React.MouseEvent) => void;
  onDropToColumn: (columnKey: string, leadId: string) => void;
  onAdd: (defaultStage: string) => void;
}

export default function LeadsKanban({ leads, totals, locale, selected, onOpen, onDropToColumn, onAdd }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const byCol: Record<string, VLead[]> = {};
  for (const c of COLUMNS) byCol[c.key] = [];
  for (const l of leads) (byCol[columnOf(l.stage)] ??= []).push(l);

  return (
    <div className="grid auto-cols-[minmax(272px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4 lg:grid-flow-row lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = byCol[col.key] ?? [];
        const isOver = overCol === col.key;
        const draggingFrom = leads.find((l) => l.id === dragId)?.stage;
        const differentCol = dragId !== null && columnOf(draggingFrom ?? "") !== col.key;
        return (
          <div
            key={col.key}
            // Har doim preventDefault — aks holda brauzer drop'ga ruxsat bermaydi
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (differentCol) setOverCol(col.key); }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              const lead = id ? leads.find((l) => l.id === id) : null;
              if (id && lead && columnOf(lead.stage) !== col.key) onDropToColumn(col.key, id);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn("min-w-0 rounded-2xl p-2.5 transition", isOver ? "bg-slate-100/70 dark:bg-white/[0.03]" : "")}
          >
            {/* Sarlavha */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: col.color, background: `${col.color}1f` }}>
                  <Icon name={col.icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{tr(locale, col.label)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold" style={{ color: col.color }}>{totals[col.key] ?? items.length}</span>
                <button onClick={() => onAdd(col.defaultStage)} title={tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add" })} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-white/[0.06]">
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Gradient chiziq */}
            <div className="mx-1 mb-3 mt-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${col.color}, ${col.color}22)` }} />

            {/* Kartalar — scrollsiz (butun sahifa scroll bo'ladi) */}
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/[0.08]">
                  <div className="text-2xl opacity-30">📭</div>
                  <p className="mt-1 text-xs text-slate-400">{tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads" })}</p>
                </div>
              ) : (
                items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    locale={locale}
                    selected={selected.has(lead.id)}
                    onOpen={onOpen}
                    onDragStart={(id, e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; setDragId(id); }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
