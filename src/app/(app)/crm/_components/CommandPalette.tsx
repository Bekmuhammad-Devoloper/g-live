"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import type { VLead } from "../_lib/leadColumns";

export interface PaletteAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

export default function CommandPalette({
  locale,
  open,
  onClose,
  leads,
  actions,
  onOpenLead,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  leads: VLead[];
  actions: PaletteAction[];
  onOpenLead: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const matchedLeads = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return leads.filter((l) => `${l.fullName} ${l.phone}`.toLowerCase().includes(s)).slice(0, 8);
  }, [q, leads]);
  const matchedActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? actions.filter((a) => a.label.toLowerCase().includes(s)) : actions;
  }, [q, actions]);

  // Yassi ro'yxat (klaviatura navigatsiyasi uchun)
  const flat = useMemo(
    () => [
      ...matchedActions.map((a) => ({ kind: "action" as const, a })),
      ...matchedLeads.map((l) => ({ kind: "lead" as const, l })),
    ],
    [matchedActions, matchedLeads]
  );

  useEffect(() => { setActive((i) => Math.min(i, Math.max(0, flat.length - 1))); }, [flat.length]);

  if (!open) return null;

  const exec = (i: number) => {
    const item = flat[i];
    if (!item) return;
    if (item.kind === "action") item.a.run();
    else onOpenLead(item.l.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); exec(active); }
          else if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <Icon name="search" className="h-4 w-4 text-slate-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Buyruq yoki lid qidiring...", ru: "Найти команду или лид...", en: "Search command or lead..." })} className="flex-1 bg-transparent text-sm outline-none dark:text-slate-100" />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {matchedActions.length > 0 && <Section label={tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" })} />}
          {matchedActions.map((a, i) => (
            <Row key={a.id} active={active === i} onHover={() => setActive(i)} onClick={() => exec(i)}>
              <Icon name={a.icon} className="h-4 w-4 text-slate-400" /> {a.label}
            </Row>
          ))}
          {matchedLeads.length > 0 && <Section label={tr(locale, { uz: "Lidlar", ru: "Лиды", en: "Leads" })} />}
          {matchedLeads.map((l, i) => {
            const idx = matchedActions.length + i;
            return (
              <Row key={l.id} active={active === idx} onHover={() => setActive(idx)} onClick={() => exec(idx)}>
                <Icon name="user" className="h-4 w-4 text-slate-400" />
                <span className="flex-1 truncate">{l.fullName}</span>
                <span className="text-xs text-slate-400">{l.phone}</span>
              </Row>
            );
          })}
          {flat.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">{tr(locale, { uz: "Hech narsa topilmadi", ru: "Ничего не найдено", en: "Nothing found" })}</p>}
        </div>
      </div>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>;
}
function Row({ active, onClick, onHover, children }: { active: boolean; onClick: () => void; onHover: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} onMouseEnter={onHover} className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200" : "text-slate-700 dark:text-slate-200"}`}>
      {children}
    </button>
  );
}
