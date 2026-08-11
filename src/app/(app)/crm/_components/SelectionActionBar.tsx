"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { COLUMNS } from "../_lib/leadColumns";
import { bulkLeadAction } from "../actions";

interface Opt { id: string; name: string }

export default function SelectionActionBar({
  ids,
  managers,
  locale,
  onDone,
}: {
  ids: string[];
  managers: Opt[];
  locale: Locale;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [menu, setMenu] = useState<"manager" | "stage" | null>(null);

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setMenu(null); onDone(); router.refresh(); });

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-pop dark:border-slate-700 dark:bg-slate-800">
        <span className="mr-1 rounded-lg bg-brand-600 px-2.5 py-1 text-sm font-semibold text-white">{ids.length} {tr(locale, { uz: "ta", ru: "шт.", en: "" })}</span>
        <span className="mr-1 hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{tr(locale, { uz: "tanlangan", ru: "выбрано", en: "selected" })}</span>

        {/* Menejer */}
        <div className="relative">
          <BarBtn icon="user" label={tr(locale, { uz: "Menejer", ru: "Менеджер", en: "Manager" })} onClick={() => setMenu(menu === "manager" ? null : "manager")} disabled={pending} />
          {menu === "manager" && (
            <Pop>
              {managers.map((m) => (
                <PopItem key={m.id} onClick={() => run(() => bulkLeadAction(ids, "assign_manager", { managerId: m.id }))}>{m.name}</PopItem>
              ))}
            </Pop>
          )}
        </div>

        {/* Bosqich */}
        <div className="relative">
          <BarBtn icon="chart" label={tr(locale, { uz: "Bosqich", ru: "Этап", en: "Stage" })} onClick={() => setMenu(menu === "stage" ? null : "stage")} disabled={pending} />
          {menu === "stage" && (
            <Pop>
              {COLUMNS.map((c) => (
                <PopItem key={c.key} onClick={() => run(() => bulkLeadAction(ids, "set_stage", { stage: c.defaultStage }))}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} /> {label(LEAD_STAGE_LABELS, c.defaultStage, locale)}
                </PopItem>
              ))}
            </Pop>
          )}
        </div>

        {/* Izoh */}
        <BarBtn icon="pencil" label={tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })} disabled={pending} onClick={() => {
          const note = window.prompt(tr(locale, { uz: "Izoh (barcha tanlanganlarga):", ru: "Комментарий (для всех выбранных):", en: "Note (for all selected):" }));
          if (note && note.trim()) run(() => bulkLeadAction(ids, "add_note", { note: note.trim() }));
        }} />

        {/* O'chirish (faqat yo'qotilganlar) */}
        <BarBtn icon="personX" label={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })} danger disabled={pending} onClick={() => {
          if (window.confirm(tr(locale, { uz: "Tanlangan yo'qotilgan lidlarni o'chirasizmi? (faqat 'Yo'qotilgan' bosqichdagilar o'chadi)", ru: "Удалить выбранные потерянные лиды? (удаляются только лиды на этапе 'Потерян')", en: "Delete the selected lost leads? (only leads at the 'Lost' stage are deleted)" }))) run(() => bulkLeadAction(ids, "delete"));
        }} />

        <button onClick={onDone} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title={tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}>✕</button>
      </div>
    </div>
  );
}

function BarBtn({ icon, label, onClick, disabled, danger }: { icon: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`}>
      <Icon name={icon} className="h-4 w-4" /> <span className="hidden md:inline">{label}</span>
    </button>
  );
}
function Pop({ children }: { children: React.ReactNode }) {
  return <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">{children}</div>;
}
function PopItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">{children}</button>;
}
