"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/lib/tr";
import { LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { colorOfStage, columnOfLead, groupColKey, type GroupColumn, type VLead } from "../_lib/leadColumns";

// Guruh ustunidagi "+" — lidni sudramasdan ro'yxatdan tanlab biriktirish.
// Tanlangan lid darhol shu guruhga yoziladi va ustunga ko'chadi.

interface Props {
  locale: Locale;
  leads: VLead[];
  pinnedIds: Set<string>;
  group: GroupColumn | null;
  onClose: () => void;
  onPick: (leadId: string) => void;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function GroupLeadPicker({ locale, leads, pinnedIds, group, onClose, onPick }: Props) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Shu ustunda turmagan lidlar — yangisi tepada
  const candidates = useMemo(() => {
    if (!group) return [];
    const own = groupColKey(group.groupId);
    const rows = leads.filter((l) => columnOfLead(l, pinnedIds) !== own);
    const needle = norm(q);
    const digits = needle.replace(/\D/g, "");
    const hit = needle
      ? rows.filter(
          (l) =>
            norm(l.fullName).includes(needle) ||
            (digits.length > 0 && (l.phone ?? "").replace(/\D/g, "").includes(digits)),
        )
      : rows;
    return [...hit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, pinnedIds, group, q]);

  if (!mounted || !group) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3.5 dark:border-white/10">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: group.color, background: `${group.color}1f` }}>
            <Icon name={group.icon} className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">{group.name}</h3>
            <p className="truncate text-xs text-slate-400">
              {L("Guruhga biriktiriladigan lidni tanlang", "Выберите лид для группы", "Pick the lead to enrol", "Lead zum Einschreiben waehlen")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
            aria-label={L("Yopish", "Закрыть", "Close", "Schliessen")}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-3 dark:border-white/10">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder={L("Ism yoki telefon", "Имя или телефон", "Name or phone", "Name oder Telefon")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-400">
              {L("Mos lid topilmadi", "Лид не найден", "No matching lead", "Kein passender Lead")}
            </p>
          ) : (
            candidates.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onPick(l.id)}
                className={
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.05] " +
                  (i > 0 ? "border-t border-slate-100 dark:border-white/[0.06]" : "")
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{l.fullName}</span>
                  <span className="block truncate text-xs text-slate-400">{l.phone}</span>
                </span>
                <span
                  className="shrink-0 rounded-md px-2 py-[3px] text-[11px] font-semibold"
                  style={{ background: `${colorOfStage(l.stage)}1f`, color: colorOfStage(l.stage) }}
                >
                  {label(LEAD_STAGE_LABELS, l.stage, locale)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
