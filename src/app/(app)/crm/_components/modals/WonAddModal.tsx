"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/tr";
import { LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { colorOfStage, columnOf, type VLead } from "../../_lib/leadColumns";

// "Qabul qilindi" ustunidagi "+" shu oynani ochadi.
//
// Ilgari u to'g'ridan-to'g'ri "Yangi lid" formasini ochardi va shu sabab
// voronkadagi mavjud lidni guruhga biriktirishning yo'li yo'q edi —
// yangi yozuv yaratilardi-yu, eski lid "Yangi" ustunida qolaverardi.
// Endi ikkita yo'l bor:
//   1) mavjud lidni tanlab guruhga biriktirish (lid WON ga ko'chadi),
//   2) butunlay yangi o'quvchi qo'shish (guruh majburiy).

interface Props {
  locale: Locale;
  open: boolean;
  leads: VLead[];
  onClose: () => void;
  /** Mavjud lid tanlandi — guruh paneli ochiladi */
  onPickLead: (lead: VLead) => void;
  /** Yangi lid formasi WON bosqichi bilan ochiladi */
  onNewLead: () => void;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function WonAddModal({ locale, open, leads, onClose, onPickLead, onNewLead }: Props) {
  const [mode, setMode] = useState<"choose" | "pick">("choose");
  const [q, setQ] = useState("");

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  // Hali qabul qilinmagan lidlar — yangisi tepada
  const candidates = useMemo(() => {
    const rows = leads.filter((l) => columnOf(l.stage) !== "won");
    const needle = norm(q);
    const digits = needle.replace(/\D/g, "");
    const hit = needle
      ? rows.filter(
          (l) =>
            norm(l.fullName).includes(needle) ||
            (digits.length > 0 && l.phone.replace(/\D/g, "").includes(digits)),
        )
      : rows;
    return [...hit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, q]);

  if (!open) return null;

  const close = () => {
    setMode("choose");
    setQ("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-pop dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {L("Qabul qilindi", "Принят", "Won", "Aufgenommen")}
            </h3>
            <p className="truncate text-xs text-slate-400">
              {mode === "choose"
                ? L("Qanday qo'shamiz?", "Как добавляем?", "How do we add?", "Wie hinzufügen?")
                : L("Guruhga biriktiriladigan lidni tanlang", "Выберите лид для группы", "Pick the lead to enrol", "Lead zum Einschreiben wahlen")}
            </p>
          </div>
        </div>

        {mode === "choose" ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/60 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-white/[0.04]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {L("Guruh biriktirish", "Привязать группу", "Assign a group", "Gruppe zuweisen")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {L(
                    "Voronkadagi lidni tanlaysiz — guruhga yozilib, shu ustunga ko'chadi",
                    "Выберите лид из воронки — он попадёт в группу и в этот столбец",
                    "Pick a lead from the funnel — it joins the group and moves here",
                    "Lead aus dem Funnel wahlen — er kommt in die Gruppe und hierher",
                  )}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { onNewLead(); close(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:border-emerald-500 dark:hover:bg-white/[0.04]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {L("Yangi o'quvchi qo'shish", "Добавить нового ученика", "Add a new student", "Neuen Schuler hinzufugen")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {L(
                    "Yangi yozuv — guruh tanlash majburiy",
                    "Новая запись — группа обязательна",
                    "A new record — a group is required",
                    "Neuer Eintrag — Gruppe erforderlich",
                  )}
                </span>
              </span>
            </button>
          </div>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder={L("Ism yoki telefon", "Имя или телефон", "Name or phone", "Name oder Telefon")}
              className="mb-2.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              {candidates.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">
                  {L("Mos lid topilmadi", "Лид не найден", "No matching lead", "Kein passender Lead")}
                </p>
              ) : (
                candidates.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { onPickLead(l); close(); }}
                    className={
                      "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.05] " +
                      (i > 0 ? "border-t border-slate-100 dark:border-slate-800" : "")
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

            <div className="mt-3.5 flex justify-between">
              <button type="button" onClick={() => setMode("choose")} className="btn-ghost">
                {L("Orqaga", "Назад", "Back", "Zuruck")}
              </button>
              <button type="button" onClick={close} className="btn-ghost">
                {L("Yopish", "Закрыть", "Close", "Schliessen")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
